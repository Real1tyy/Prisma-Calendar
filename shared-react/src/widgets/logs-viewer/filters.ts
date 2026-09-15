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

function formatLocalDay(ts: number): string {
	const date = new Date(ts);
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatLogDate(ts: number): string {
	return `${formatLocalDay(ts)} ${formatLogTime(ts)}`;
}

/** `datetime-local` value with millisecond precision, in local wall-clock — the inverse of {@link parseLocalDateTime}. */
export function formatLocalDateTimeInput(ts: number): string {
	return `${formatLocalDay(ts)}T${formatLogTime(ts)}`;
}

export interface LogTimeBounds {
	min: number;
	max: number;
}

/** The oldest and newest instant in the loaded entries, or `null` when there are none. */
export function logTimeBounds(entries: readonly LogEntry[]): LogTimeBounds | null {
	if (entries.length === 0) return null;
	let min = Infinity;
	let max = -Infinity;
	for (const entry of entries) {
		if (entry.ts < min) min = entry.ts;
		if (entry.ts > max) max = entry.ts;
	}
	return { min, max };
}

/**
 * A bound at (or beyond) the loaded range is stored as "unbounded", so a live
 * buffer keeps showing entries newer than the instant the range was read at.
 */
export function boundToFilterValue(ts: number, edge: number, side: "from" | "to"): string {
	const atEdge = side === "from" ? ts <= edge : ts >= edge;
	return atEdge ? "" : formatLocalDateTimeInput(ts);
}
