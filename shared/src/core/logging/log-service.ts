import { Subject, type Observable } from "rxjs";

import { scrubSecrets } from "./redact";
import { RingBuffer } from "./ring-buffer";
import { stringifyLogData } from "./serialize";
import { LOG_LEVEL_SEVERITY, type LogChange, type LogEntry, type LogFilter, type LogLevel } from "./types";

export const DEFAULT_LOG_CAPACITY = 2000;
export const DEFAULT_LOG_LEVEL: LogLevel = "info";

/**
 * How much of a serialized `data` payload free-text search reads. `query` is a
 * needle-in-the-haystack aid, not a full-text index — without a bound, one
 * caller logging a huge object makes every subsequent query pay for it.
 */
const MAX_SEARCHABLE_DATA_CHARS = 2000;

export interface LogServiceOptions {
	/**
	 * Required, not defaulted: keeping `Date.now()` out of this module is what
	 * makes the buffer deterministic under test. Plugins pass `() => Date.now()`
	 * at their boundary.
	 */
	now: () => number;
	capacity?: number;
	level?: LogLevel;
}

interface BufferedEntry {
	readonly entry: LogEntry;
	/** Serialized `data`, memoized on the first query that needs it — never on append. */
	searchText?: string;
}

function normalizeCapacity(capacity: number | undefined): number {
	// Capacity reaches us from settings eventually; a nonsense value should fall
	// back to the default rather than throw during plugin startup.
	if (capacity === undefined || !Number.isFinite(capacity)) return DEFAULT_LOG_CAPACITY;
	return Math.max(1, Math.floor(capacity));
}

function toSet<T extends string>(value: T | readonly T[]): ReadonlySet<T> {
	return new Set(typeof value === "string" ? [value] : value);
}

function searchTextOf(buffered: BufferedEntry): string {
	buffered.searchText ??= stringifyLogData(buffered.entry.data).slice(0, MAX_SEARCHABLE_DATA_CHARS);
	return buffered.searchText;
}

function matches(buffered: BufferedEntry, filter: LogFilter): boolean {
	const { entry } = buffered;

	if (filter.level !== undefined && !toSet(filter.level).has(entry.level)) return false;
	if (filter.minLevel !== undefined && LOG_LEVEL_SEVERITY[entry.level] < LOG_LEVEL_SEVERITY[filter.minLevel]) {
		return false;
	}
	if (filter.scope !== undefined && !toSet(filter.scope).has(entry.scope)) return false;
	if (filter.since !== undefined && entry.ts < filter.since) return false;
	if (filter.until !== undefined && entry.ts > filter.until) return false;

	if (filter.query) {
		const needle = filter.query.toLowerCase();
		const haystack = `${entry.message}\n${searchTextOf(buffered)}`.toLowerCase();
		if (!haystack.includes(needle)) return false;
	}

	return true;
}

/**
 * Leveled, structured, in-memory log buffer — one instance per plugin.
 *
 * The write side is the whole codebase (`log.warn("indexer", …)` in place of
 * `console.warn`); the read side is the logs viewer, Doctor, and debug export.
 * Entries are held by reference and never serialized on append, so logging an
 * object costs a push. See [[spec-in-memory-log-service]].
 */
export class LogService {
	private readonly buffer: RingBuffer<BufferedEntry>;
	private readonly now: () => number;
	private readonly changes = new Subject<LogChange>();
	private level: LogLevel;
	private seq = 0;

	readonly capacity: number;
	/** Emits per retained append and per `clear`, so consumers update without polling. */
	readonly changes$: Observable<LogChange> = this.changes.asObservable();

	constructor(options: LogServiceOptions) {
		this.now = options.now;
		this.capacity = normalizeCapacity(options.capacity);
		this.level = options.level ?? DEFAULT_LOG_LEVEL;
		this.buffer = new RingBuffer<BufferedEntry>(this.capacity);
	}

	getLevel(): LogLevel {
		return this.level;
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	get size(): number {
		return this.buffer.length;
	}

	debug(scope: string, message: string, data?: unknown): void {
		this.log("debug", scope, message, data);
	}

	info(scope: string, message: string, data?: unknown): void {
		this.log("info", scope, message, data);
	}

	warn(scope: string, message: string, data?: unknown): void {
		this.log("warn", scope, message, data);
	}

	error(scope: string, message: string, data?: unknown): void {
		this.log("error", scope, message, data);
	}

	log(level: LogLevel, scope: string, message: string, data?: unknown): void {
		try {
			if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.level]) return;

			const entry: LogEntry = {
				seq: this.seq++,
				ts: this.now(),
				level,
				scope,
				message,
				// Never let a credential into the buffer — see [[decision-observability-privacy-posture]].
				...(data === undefined ? {} : { data: scrubSecrets(data) }),
			};
			this.buffer.push({ entry });
			this.changes.next({ type: "append", entry });
		} catch {
			// A logging failure must never break the feature being logged, and the
			// only place left to report it would be the buffer we just failed to
			// write to. Losing the entry is the lesser harm.
		}
	}

	/** Full buffer, oldest-first. A fresh array each call — later appends can't mutate it. */
	snapshot(): LogEntry[] {
		return this.buffer.toArray().map((buffered) => buffered.entry);
	}

	entries(filter?: LogFilter): LogEntry[] {
		if (!filter) return this.snapshot();
		return this.buffer
			.toArray()
			.filter((buffered) => matches(buffered, filter))
			.map((buffered) => buffered.entry);
	}

	clear(): void {
		this.buffer.clear();
		this.changes.next({ type: "clear" });
	}

	/** Complete the change stream on plugin unload so subscribers tear down. */
	destroy(): void {
		this.changes.complete();
	}
}
