import { parseActiveLogName, parseRotatedLogName } from "./file-sink";
import type { LogFileSystem } from "./log-file-system";
import { LOG_LEVEL_SEVERITY, type LogEntry, type LogLevel } from "./types";

export interface LogFileInfo {
	/** Vault-relative path, as the file system takes it. */
	path: string;
	name: string;
	/** Rotation instant, or `null` for the file a sink is still appending to. */
	rotatedAt: number | null;
	device: string;
	size: number;
}

export interface LogFilePage {
	/** Newest-first, so the viewer renders the slice without reversing it. */
	entries: LogEntry[];
	/** Non-empty lines in the whole file — the denominator for "N of M". */
	total: number;
	offset: number;
	hasMore: boolean;
}

/**
 * Reads the JSON-lines files the {@link FileSink} wrote. The viewer's second
 * source: history from before this session, which the in-memory buffer has
 * long since evicted.
 */
export interface LogFileSource {
	/** Newest first, the active file ahead of the rotated ones. */
	list(): Promise<LogFileInfo[]>;
	/** `offset` counts entries back from the newest line in the file. */
	page(path: string, offset: number, limit: number): Promise<LogFilePage>;
	/** Drop cached line offsets. The active file grows while the viewer is open. */
	invalidate(path?: string): void;
}

function isLogLevel(value: unknown): value is LogLevel {
	return typeof value === "string" && Object.hasOwn(LOG_LEVEL_SEVERITY, value);
}

/**
 * One file line back into an entry, or `null` for a line no sink wrote — a
 * half-flushed tail, a merge conflict marker a sync tool left behind. A single
 * corrupt line must cost that line and nothing else.
 */
export function parseLogFileLine(line: string, seq: number): LogEntry | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

	const record = parsed as Record<string, unknown>;
	const time = record["time"];
	const ts = typeof record["ts"] === "number" ? record["ts"] : typeof time === "string" ? Date.parse(time) : NaN;
	if (!Number.isFinite(ts)) return null;

	return {
		seq,
		ts,
		level: isLogLevel(record["level"]) ? record["level"] : "info",
		scope: typeof record["scope"] === "string" ? record["scope"] : "",
		message: typeof record["message"] === "string" ? record["message"] : "",
		...(record["data"] === undefined ? {} : { data: record["data"] }),
	};
}

function describe(path: string): Omit<LogFileInfo, "size"> | null {
	const name = path.slice(path.lastIndexOf("/") + 1);
	const active = parseActiveLogName(path);
	if (active) return { path, name, rotatedAt: null, device: active.device };
	const rotated = parseRotatedLogName(path);
	if (rotated) return { path, name, rotatedAt: rotated.time, device: rotated.device };
	return null;
}

/** Newest first: a file still being appended to outranks every rotated one. */
function byRecency(a: LogFileInfo, b: LogFileInfo): number {
	if (a.rotatedAt === null || b.rotatedAt === null) {
		if (a.rotatedAt === b.rotatedAt) return a.name.localeCompare(b.name);
		return a.rotatedAt === null ? -1 : 1;
	}
	return b.rotatedAt - a.rotatedAt;
}

/**
 * `createLogFileSource` over a directory of sink-written files.
 *
 * Obsidian's `DataAdapter` has no streaming read, so a file's text is fetched
 * whole — what is bounded is `JSON.parse`, which runs only over the lines of
 * the page being shown. That is where the cost of a multi-MB file actually
 * lives: splitting on newlines is a linear string scan, while parsing tens of
 * thousands of records into objects is what would freeze the view. Line
 * offsets are cached per path so paging back through one file does not re-read
 * it; `invalidate` drops the cache for a file that is still being appended to.
 */
export function createLogFileSource(fs: LogFileSystem, dir: string): LogFileSource {
	const root = dir.replace(/\/+$/, "");
	const lineCache = new Map<string, string[]>();

	async function linesOf(path: string): Promise<string[]> {
		const cached = lineCache.get(path);
		if (cached) return cached;
		const text = await fs.read(path);
		const lines = text.split("\n").filter((line) => line.trim() !== "");
		lineCache.set(path, lines);
		return lines;
	}

	return {
		async list(): Promise<LogFileInfo[]> {
			if (!(await fs.exists(root))) return [];
			const described = (await fs.listFiles(root))
				.map((path) => describe(path))
				.filter((info): info is Omit<LogFileInfo, "size"> => info !== null);
			const files = await Promise.all(
				described.map(async (info) => ({ ...info, size: (await fs.stat(info.path))?.size ?? 0 }))
			);
			return files.sort(byRecency);
		},

		async page(path: string, offset: number, limit: number): Promise<LogFilePage> {
			const lines = await linesOf(path);
			const total = lines.length;
			const end = Math.max(0, total - Math.max(0, offset));
			const start = Math.max(0, end - Math.max(0, limit));

			const entries: LogEntry[] = [];
			for (let index = end - 1; index >= start; index--) {
				const entry = parseLogFileLine(lines[index], index);
				if (entry) entries.push(entry);
			}
			return { entries, total, offset, hasMore: start > 0 };
		},

		invalidate(path?: string): void {
			if (path === undefined) lineCache.clear();
			else lineCache.delete(path);
		},
	};
}
