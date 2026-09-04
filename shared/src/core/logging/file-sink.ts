import type { LogFileSystem } from "./log-file-system";
import { formatLogLine } from "./serialize";
import type { LogEntry, LogSink } from "./types";

export const LOG_FILE_ACTIVE_NAME = "current.jsonl";
const DEFAULT_FLUSH_DELAY_MS = 250;
const MS_PER_DAY = 86_400_000;
const ROTATED_NAME = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})(?:-\d+)?\.jsonl$/;

/** `(callback, delayMs) → cancel`. Injected so tests drive flushes by hand. */
export type FlushScheduler = (callback: () => void, delayMs: number) => () => void;

export interface FileSinkOptions {
	fs: LogFileSystem;
	now: () => number;
	/** Vault-relative directory the active + rotated files live in. */
	dir: string;
	maxFileSizeKb: number;
	maxFiles: number;
	maxAgeDays: number;
	/**
	 * Called once, on the failure that disabled the sink. The sink has already
	 * stopped accepting writes when this fires, so the handler may log freely.
	 */
	onError: (error: unknown) => void;
	flushDelayMs?: number;
	schedule?: FlushScheduler;
}

const defaultSchedule: FlushScheduler = (callback, delayMs) => {
	const handle = window.setTimeout(callback, delayMs);
	return () => window.clearTimeout(handle);
};

function basename(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

/** Timestamp a rotated file's name encodes, or `null` for a file the sink does not own. */
export function rotatedFileTime(path: string): number | null {
	const match = ROTATED_NAME.exec(basename(path));
	if (!match) return null;
	const [, year, month, day, hour, minute, second, millisecond] = match;
	return Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second),
		Number(millisecond)
	);
}

function rotatedStamp(ts: number): string {
	const iso = new Date(ts).toISOString();
	return `${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 19).replaceAll(":", "")}-${iso.slice(20, 23)}`;
}

/**
 * JSON-lines file sink with size rotation and count/age retention.
 *
 * Writes are batched: `write` only queues a line and arms one timer, so the
 * hot path never awaits IO. Every failure disables the sink for good and
 * reports once through `onError` — a log file that cannot be written is not
 * worth retrying against on every entry, and the in-memory sink still has the
 * data. Rotation renames the active file to a UTC-stamped sibling; pruning
 * reads only those siblings (one directory listing, no per-file stat) and
 * never touches the active file. See [[spec-logging-config-sinks-and-instrumentation]].
 */
export class FileSink implements LogSink {
	readonly activePath: string;
	private readonly fs: LogFileSystem;
	private readonly now: () => number;
	private readonly dir: string;
	private readonly maxBytes: number;
	private readonly maxFiles: number;
	private readonly maxAgeMs: number;
	private readonly onError: (error: unknown) => void;
	private readonly flushDelayMs: number;
	private readonly schedule: FlushScheduler;
	private readonly encoder = new TextEncoder();

	private pending: string[] = [];
	private cancelTimer: (() => void) | null = null;
	private inFlight: Promise<void> | null = null;
	private starting: Promise<void> | null = null;
	private activeSize = 0;
	private disabled = false;

	constructor(options: FileSinkOptions) {
		this.fs = options.fs;
		this.now = options.now;
		this.dir = options.dir.replace(/\/+$/, "");
		this.activePath = `${this.dir}/${LOG_FILE_ACTIVE_NAME}`;
		this.maxBytes = Math.max(1, options.maxFileSizeKb) * 1024;
		this.maxFiles = Math.max(0, Math.floor(options.maxFiles));
		this.maxAgeMs = Math.max(0, options.maxAgeDays) * MS_PER_DAY;
		this.onError = options.onError;
		this.flushDelayMs = options.flushDelayMs ?? DEFAULT_FLUSH_DELAY_MS;
		this.schedule = options.schedule ?? defaultSchedule;
	}

	get isDisabled(): boolean {
		return this.disabled;
	}

	/**
	 * Create the directory, learn the active file's size, and prune leftovers
	 * from earlier sessions. Memoized: the first flush may race the controller's
	 * own `start()` call, and two concurrent `mkdir`s are not worth the risk.
	 */
	start(): Promise<void> {
		this.starting ??= this.initialize();
		return this.starting;
	}

	private async initialize(): Promise<void> {
		if (this.disabled) return;
		try {
			if (!(await this.fs.exists(this.dir))) await this.fs.mkdir(this.dir);
			this.activeSize = (await this.fs.stat(this.activePath))?.size ?? 0;
			await this.prune();
		} catch (error) {
			this.fail(error);
		}
	}

	write(entry: LogEntry): void {
		if (this.disabled) return;
		this.pending.push(formatLogLine(entry));
		this.cancelTimer ??= this.schedule(() => {
			this.cancelTimer = null;
			void this.flush();
		}, this.flushDelayMs);
	}

	/** Serialized: a flush that starts while another is writing waits for it. */
	flush(): Promise<void> {
		this.inFlight = (this.inFlight ?? Promise.resolve()).then(() => this.drain());
		return this.inFlight;
	}

	async dispose(): Promise<void> {
		this.cancelTimer?.();
		this.cancelTimer = null;
		await this.flush();
		this.disabled = true;
	}

	private async drain(): Promise<void> {
		if (this.disabled || this.pending.length === 0) return;
		const chunk = this.pending.join("");
		this.pending = [];
		try {
			await this.start();
			if (this.disabled) return;
			await this.fs.append(this.activePath, chunk);
			this.activeSize += this.encoder.encode(chunk).length;
			if (this.activeSize > this.maxBytes) await this.rotate();
		} catch (error) {
			this.fail(error);
		}
	}

	private async rotate(): Promise<void> {
		const stamp = rotatedStamp(this.now());
		let target = `${this.dir}/${stamp}.jsonl`;
		// Two rotations inside one millisecond only happen under a fake clock,
		// but a silent overwrite would lose a whole file — disambiguate instead.
		for (let suffix = 1; await this.fs.exists(target); suffix++) {
			target = `${this.dir}/${stamp}-${suffix}.jsonl`;
		}
		await this.fs.rename(this.activePath, target);
		this.activeSize = 0;
		await this.prune();
	}

	private async prune(): Promise<void> {
		const rotated = (await this.fs.listFiles(this.dir))
			.map((path) => ({ path, time: rotatedFileTime(path) }))
			.filter((file): file is { path: string; time: number } => file.time !== null)
			.sort((a, b) => b.time - a.time);
		const cutoff = this.now() - this.maxAgeMs;
		for (const [index, file] of rotated.entries()) {
			if (index >= this.maxFiles || file.time < cutoff) await this.fs.remove(file.path);
		}
	}

	private fail(error: unknown): void {
		if (this.disabled) return;
		this.disabled = true;
		this.pending = [];
		this.cancelTimer?.();
		this.cancelTimer = null;
		this.onError(error);
	}
}
