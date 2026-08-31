export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Ascending severity. Threshold gating and `minLevel` filtering compare these ordinals. */
export const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export interface LogEntry {
	/** Monotonic per service instance — survives eviction, so it is a stable row key. */
	readonly seq: number;
	readonly ts: number;
	readonly level: LogLevel;
	readonly scope: string;
	readonly message: string;
	readonly data?: unknown;
}

/**
 * Every provided field must match (AND). `level` and `minLevel` answer the two
 * different questions consumers ask: a viewer's level chips are a set membership
 * test, while "everything from warn up" is an ordinal comparison.
 */
export interface LogFilter {
	level?: LogLevel | readonly LogLevel[];
	minLevel?: LogLevel;
	scope?: string | readonly string[];
	/** Case-insensitive substring over the message and the serialized `data`. */
	query?: string;
	/** Inclusive `ts` bounds. */
	since?: number;
	until?: number;
}

export type LogChange = { readonly type: "append"; readonly entry: LogEntry } | { readonly type: "clear" };
