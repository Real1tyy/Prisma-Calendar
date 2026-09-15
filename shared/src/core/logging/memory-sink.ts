import { logSearchText, matchesLogFilter } from "./filter";
import { RingBuffer } from "./ring-buffer";
import type { LogEntry, LogFilter, LogSink } from "./types";

export const DEFAULT_LOG_CAPACITY = 2000;

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

function searchTextOf(buffered: BufferedEntry): string {
	buffered.searchText ??= logSearchText(buffered.entry);
	return buffered.searchText;
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
			.filter((buffered) => matchesLogFilter(buffered.entry, filter, () => searchTextOf(buffered)))
			.map((buffered) => buffered.entry);
	}

	clear(): void {
		this.buffer.clear();
	}
}
