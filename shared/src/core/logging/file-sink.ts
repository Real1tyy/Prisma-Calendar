import { DEVICE_ID_LENGTH } from "./device-id";
import type { LogFileSystem } from "./log-file-system";
import { formatLogLine } from "./serialize";
import type { LogEntry, LogSink } from "./types";

const ACTIVE_STEM = "current";
const DEFAULT_FLUSH_DELAY_MS = 250;
const MS_PER_DAY = 86_400_000;
/**
 * `<yyyymmdd>-<hhmmss>-<mmm>-<device>[-<n>].jsonl`. The device segment is
 * exactly {@link DEVICE_ID_LENGTH} characters and the collision counter at
 * most four digits, so the two can never be read for each other.
 */
const ROTATED_NAME = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})-([0-9a-z]{8})(?:-(\d{1,4}))?\.jsonl$/;

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
	 * Identifier of the device writing these files, from `resolveDeviceLogId`.
	 * It names every file this sink owns and scopes retention to them.
	 */
	deviceId: string;
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

/** What a rotated file's name encodes: when it was rotated, and by which device. */
export interface RotatedLogFile {
	time: number;
	device: string;
}

/** Reads a rotated file's name, or `null` for a file no sink wrote. */
export function parseRotatedLogName(path: string): RotatedLogFile | null {
	const match = ROTATED_NAME.exec(basename(path));
	if (!match) return null;
	const [, year, month, day, hour, minute, second, millisecond, device] = match;
	return {
		time: Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second),
			Number(millisecond)
		),
		device,
	};
}

/**
 * The device segment used in file names: lower-case alphanumerics, padded or
 * truncated to a fixed width so the name stays unambiguous to parse.
 */
function deviceSegment(deviceId: string): string {
	return deviceId
		.toLowerCase()
		.replace(/[^0-9a-z]/g, "")
		.slice(0, DEVICE_ID_LENGTH)
		.padEnd(DEVICE_ID_LENGTH, "0");
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
 * never touches the active file.
 *
 * Every file name carries the writing device's id, because a vault whose sync
 * tool covers `.obsidian` would otherwise have two machines appending to one
 * `current.jsonl` and racing into conflict copies. Retention is scoped the
 * same way: a device prunes only the files it wrote, never another machine's
 * history. See [[spec-logging-config-sinks-and-instrumentation]].
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
	private readonly device: string;
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
		this.device = deviceSegment(options.deviceId);
		this.activePath = `${this.dir}/${ACTIVE_STEM}-${this.device}.jsonl`;
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
			// Through the getter: `start()` can disable the sink, but TypeScript keeps
			// the narrowing from the guard above and would read this as always-false.
			if (this.isDisabled) return;
			await this.fs.append(this.activePath, chunk);
			this.activeSize += this.encoder.encode(chunk).length;
			if (this.activeSize > this.maxBytes) await this.rotate();
		} catch (error) {
			this.fail(error);
		}
	}

	private async rotate(): Promise<void> {
		await this.fs.rename(this.activePath, await this.freeRotatedPath());
		this.activeSize = 0;
		await this.prune();
	}

	/** A rotated name for right now that nothing occupies yet. */
	private async freeRotatedPath(): Promise<string> {
		const stem = `${rotatedStamp(this.now())}-${this.device}`;
		let target = `${this.dir}/${stem}.jsonl`;
		// Two rotations inside one millisecond only happen under a fake clock,
		// but a silent overwrite would lose a whole file — disambiguate instead.
		for (let suffix = 1; await this.fs.exists(target); suffix++) {
			target = `${this.dir}/${stem}-${suffix}.jsonl`;
		}
		return target;
	}

	private async prune(): Promise<void> {
		const rotated = (await this.fs.listFiles(this.dir))
			.map((path) => ({ path, parsed: parseRotatedLogName(path) }))
			.filter((file): file is { path: string; parsed: RotatedLogFile } => file.parsed !== null)
			// Another device's history is not ours to delete, however old it is.
			.filter((file) => file.parsed.device === this.device)
			.map((file) => ({ path: file.path, time: file.parsed.time }))
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
