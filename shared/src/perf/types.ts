// Runtime performance instrumentation primitives shared across every plugin.
// This module is bundled into production plugin code, so it must stay pure:
// no node built-ins, no playwright, no heavy deps — just `performance.now()`
// and in-memory aggregation. The tracker is a no-op until `enable()` is called
// (the harness flips it on in stress mode), so the shipped overhead is a single
// boolean check per stage boundary.

/** Aggregated stats for one repeatedly-measured stage (all values in ms). */
export interface PerfTimingSummary {
	count: number;
	totalMs: number;
	avgMs: number;
	minMs: number;
	maxMs: number;
	p50Ms: number;
	p95Ms: number;
}

/** Shape version stamped on every snapshot — bump when `PerfSnapshot` changes. */
export const PERF_SNAPSHOT_SCHEMA_VERSION = 1 as const;

/** A point-in-time drain of everything the tracker has recorded. */
export interface PerfSnapshot {
	/** Shape version for downstream report parsing. */
	schemaVersion: typeof PERF_SNAPSHOT_SCHEMA_VERSION;
	/** Monotonic per-tracker drain counter — distinguishes successive snapshots. */
	sequence: number;
	createdAt: string;
	counters: Record<string, number>;
	timings: Record<string, PerfTimingSummary>;
	/** Free-form identity (pluginId, pluginVersion, mode, …), set by the caller. */
	metadata?: Record<string, string | number | boolean>;
}

export interface PerfTrackerOptions {
	/**
	 * Cap the retained samples per timing (keeps the most recent N) so a
	 * pathological stress run can't grow an unbounded array. Unset = unbounded.
	 */
	maxSamplesPerTiming?: number;
	/** Emit `performance.mark`/`measure` so stages show inline in a CDP trace. */
	emitUserTimingMarks?: boolean;
}

export interface PerfTracker {
	/** Whether measurement is active. When false, every method is a cheap no-op. */
	readonly enabled: boolean;
	enable(options?: PerfTrackerOptions): void;
	disable(): void;

	/** Time a synchronous stage, returning its result unchanged. */
	measure<T>(name: string, fn: () => T): T;
	/** Time an async stage, preserving the resolved value or rejection. */
	measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T>;
	/** Record a pre-computed duration sample directly. */
	record(name: string, durationMs: number): void;
	/** Record many `[name, durationMs]` samples at once (e.g. imported from CDP). */
	recordMany(samples: Iterable<readonly [name: string, durationMs: number]>): void;
	/** Emit a `performance.mark` so the stage shows up inline in a CDP trace. */
	mark(name: string): void;

	/** Bump a named counter (events indexed, occurrences generated, …). */
	increment(name: string, by?: number): void;
	/** Set a named counter to an absolute value. */
	setCounter(name: string, value: number): void;

	snapshot(): PerfSnapshot;
	reset(): void;
}
