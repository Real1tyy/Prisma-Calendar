import { logSearchText, matchesLogFilter } from "./filter";
import { RingBuffer } from "./ring-buffer";
import type { LogEntry, LogFilter, LogSink } from "./types";

/** Capacity of the info-and-above tier. */
export const DEFAULT_LOG_CAPACITY = 2000;
/** Capacity of the debug tier, held apart so a debug burst never evicts a warning. */
export const DEFAULT_DEBUG_LOG_CAPACITY = 2000;

interface BufferedEntry {
	readonly entry: LogEntry;
	/** Serialized `data`, memoized on the first query that needs it — never on append. */
	searchText?: string;
}

function normalizeCapacity(capacity: number | undefined, fallback: number): number {
	// Capacity reaches us from settings eventually; a nonsense value should fall
	// back to the default rather than throw during plugin startup.
	if (capacity === undefined || !Number.isFinite(capacity)) return fallback;
	return Math.max(1, Math.floor(capacity));
}

function searchTextOf(buffered: BufferedEntry): string {
	buffered.searchText ??= logSearchText(buffered.entry);
	return buffered.searchText;
}

/** Two oldest-first runs, each ascending by `seq`, merged into one. */
function mergeBySeq(a: readonly BufferedEntry[], b: readonly BufferedEntry[]): BufferedEntry[] {
	const merged: BufferedEntry[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const left = a[i];
		const right = b[j];
		if (left.entry.seq <= right.entry.seq) {
			merged.push(left);
			i++;
		} else {
			merged.push(right);
			j++;
		}
	}
	return merged.concat(a.slice(i), b.slice(j));
}

export interface MemorySinkOptions {
	capacity?: number | undefined;
	debugCapacity?: number | undefined;
}

/**
 * The buffer behind `LogService` — the one sink that is always present,
 * because the viewer, Doctor and debug export all read from it. Every level is
 * kept: `debug` in its own ring, everything else in another, so the chatty tier
 * can only ever evict itself
 * ([[decision-debug-logs-are-always-retained-in-memory-and-hidden-by-default]]).
 * Entries are held by reference and never serialized on write, so logging an
 * object costs a push.
 */
export class MemorySink implements LogSink {
	private readonly main: RingBuffer<BufferedEntry>;
	private readonly debug: RingBuffer<BufferedEntry>;
	readonly capacity: number;
	readonly debugCapacity: number;

	constructor(options: MemorySinkOptions = {}) {
		this.capacity = normalizeCapacity(options.capacity, DEFAULT_LOG_CAPACITY);
		this.debugCapacity = normalizeCapacity(options.debugCapacity, DEFAULT_DEBUG_LOG_CAPACITY);
		this.main = new RingBuffer<BufferedEntry>(this.capacity);
		this.debug = new RingBuffer<BufferedEntry>(this.debugCapacity);
	}

	get size(): number {
		return this.main.length + this.debug.length;
	}

	write(entry: LogEntry): void {
		(entry.level === "debug" ? this.debug : this.main).push({ entry });
	}

	/** Full buffer, oldest-first. A fresh array each call — later writes can't mutate it. */
	snapshot(): LogEntry[] {
		return this.buffered().map((buffered) => buffered.entry);
	}

	entries(filter?: LogFilter): LogEntry[] {
		if (!filter) return this.snapshot();
		return this.buffered()
			.filter((buffered) => matchesLogFilter(buffered.entry, filter, () => searchTextOf(buffered)))
			.map((buffered) => buffered.entry);
	}

	clear(): void {
		this.main.clear();
		this.debug.clear();
	}

	private buffered(): BufferedEntry[] {
		return mergeBySeq(this.main.toArray(), this.debug.toArray());
	}
}
