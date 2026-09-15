import { filterLogEntries, type LogEntry, type LogFilter, type LogLevel } from "@real1ty/obsidian-plugins";

/** What the toolbar holds. Every field is a string or a list so it round-trips through inputs. */
export interface LogViewFilters {
	/** Empty means every level — the chips start unpressed and unrestricted. */
	levels: readonly LogLevel[];
	/** Empty means every scope; several means any of them ("indexer" or "sync"). */
	scopes: readonly string[];
	/** `datetime-local` values, read as local wall-clock. Empty means unbounded. */
	from: string;
	to: string;
	query: string;
}

export const EMPTY_LOG_VIEW_FILTERS: LogViewFilters = { levels: [], scopes: [], from: "", to: "", query: "" };

/**
 * `datetime-local` carries no offset, and JS reads an offsetless date-time as
 * local — which is what we want. The interval a user types is the wall clock
 * they were watching, so no UTC shift is applied anywhere on this path.
 */
export function parseLocalDateTime(value: string): number | undefined {
	if (value === "") return undefined;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function toLogFilter(filters: LogViewFilters): LogFilter {
	const since = parseLocalDateTime(filters.from);
	const until = parseLocalDateTime(filters.to);
	return {
		...(filters.levels.length > 0 ? { level: filters.levels } : {}),
		...(filters.scopes.length > 0 ? { scope: filters.scopes } : {}),
		...(filters.query !== "" ? { query: filters.query } : {}),
		...(since === undefined ? {} : { since }),
		...(until === undefined ? {} : { until }),
	};
}

export function applyLogViewFilters(entries: readonly LogEntry[], filters: LogViewFilters): LogEntry[] {
	return filterLogEntries(entries, toLogFilter(filters));
}

export function isFiltered(filters: LogViewFilters): boolean {
	return Object.keys(toLogFilter(filters)).length > 0;
}

/** The scopes actually present in the loaded entries — the only ones worth offering. */
export function observedScopes(entries: readonly LogEntry[]): string[] {
	return [...new Set(entries.map((entry) => entry.scope))].filter((scope) => scope !== "").sort();
}

const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

/** Local wall-clock `HH:MM:SS.mmm` — locale-independent, so it reads the same everywhere. */
export function formatLogTime(ts: number): string {
	const date = new Date(ts);
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function formatLogDate(ts: number): string {
	const date = new Date(ts);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${formatLogTime(ts)}`;
}
