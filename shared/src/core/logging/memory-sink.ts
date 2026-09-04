import { RingBuffer } from "./ring-buffer";
import { stringifyLogData } from "./serialize";
import { LOG_LEVEL_SEVERITY, type LogEntry, type LogFilter, type LogSink } from "./types";

export const DEFAULT_LOG_CAPACITY = 2000;

/**
 * How much of a serialized `data` payload free-text search reads. `query` is a
 * needle-in-the-haystack aid, not a full-text index — without a bound, one
 * caller logging a huge object makes every subsequent query pay for it.
 */
const MAX_SEARCHABLE_DATA_CHARS = 2000;

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
 * The ring buffer behind `LogService` — the one sink that is always present,
 * because the viewer, Doctor and debug export all read from it. Entries are
 * held by reference and never serialized on write, so logging an object costs
 * a push.
 */
export class MemorySink implements LogSink {
	private readonly buffer: RingBuffer<BufferedEntry>;
	readonly capacity: number;

	constructor(capacity?: number) {
		this.capacity = normalizeCapacity(capacity);
		this.buffer = new RingBuffer<BufferedEntry>(this.capacity);
	}

	get size(): number {
		return this.buffer.length;
	}

	write(entry: LogEntry): void {
		this.buffer.push({ entry });
	}

	/** Full buffer, oldest-first. A fresh array each call — later writes can't mutate it. */
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
	}
}
