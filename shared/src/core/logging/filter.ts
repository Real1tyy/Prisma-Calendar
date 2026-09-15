import { stringifyLogData } from "./serialize";
import { LOG_LEVEL_SEVERITY, type LogEntry, type LogFilter } from "./types";

/**
 * How much of a serialized `data` payload free-text search reads. `query` is a
 * needle-in-the-haystack aid, not a full-text index — without a bound, one
 * caller logging a huge object makes every subsequent query pay for it.
 */
export const MAX_SEARCHABLE_DATA_CHARS = 2000;

export function logSearchText(entry: LogEntry): string {
	return stringifyLogData(entry.data).slice(0, MAX_SEARCHABLE_DATA_CHARS);
}

function toSet<T extends string>(value: T | readonly T[]): ReadonlySet<T> {
	return new Set(typeof value === "string" ? [value] : value);
}

/**
 * The one `LogFilter` matcher. Both readers share it: the in-memory buffer
 * (which passes a memoizing `searchText`, so a repeated query does not
 * re-serialize the same `data`) and the logs viewer filtering entries paged in
 * from a file, where there is nothing to memoize against.
 */
export function matchesLogFilter(entry: LogEntry, filter: LogFilter, searchText?: () => string): boolean {
	if (filter.level !== undefined && !toSet(filter.level).has(entry.level)) return false;
	if (filter.minLevel !== undefined && LOG_LEVEL_SEVERITY[entry.level] < LOG_LEVEL_SEVERITY[filter.minLevel]) {
		return false;
	}
	if (filter.scope !== undefined && !toSet(filter.scope).has(entry.scope)) return false;
	if (filter.since !== undefined && entry.ts < filter.since) return false;
	if (filter.until !== undefined && entry.ts > filter.until) return false;

	if (filter.query) {
		const needle = filter.query.toLowerCase();
		const haystack =
			`${entry.message}\n${entry.scope}\n${searchText ? searchText() : logSearchText(entry)}`.toLowerCase();
		if (!haystack.includes(needle)) return false;
	}

	return true;
}

/** Filter an arbitrary entry list — a disk page, a copied selection, a test fixture. */
export function filterLogEntries(entries: readonly LogEntry[], filter?: LogFilter): LogEntry[] {
	if (!filter) return [...entries];
	return entries.filter((entry) => matchesLogFilter(entry, filter));
}
