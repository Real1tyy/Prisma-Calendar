import { summarizeSamples } from "./stats";
import {
	PERF_SNAPSHOT_SCHEMA_VERSION,
	type PerfSnapshot,
	type PerfTimingSummary,
	type PerfTracker,
	type PerfTrackerOptions,
} from "./types";

class DefaultPerfTracker implements PerfTracker {
	private active = false;
	private maxSamplesPerTiming: number | undefined;
	private emitMarks = false;
	private sequence = 0;
	private readonly samples = new Map<string, number[]>();
	private readonly counters = new Map<string, number>();

	get enabled(): boolean {
		return this.active;
	}

	enable(options?: PerfTrackerOptions): void {
		this.active = true;
		this.maxSamplesPerTiming = options?.maxSamplesPerTiming;
		this.emitMarks = options?.emitUserTimingMarks ?? false;
	}

	disable(): void {
		this.active = false;
	}

	measure<T>(name: string, fn: () => T): T {
		if (!this.active) return fn();
		const start = performance.now();
		try {
			return fn();
		} finally {
			this.record(name, performance.now() - start);
		}
	}

	measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
		if (!this.active) return fn();
		const start = performance.now();
		return fn().finally(() => this.record(name, performance.now() - start));
	}

	record(name: string, durationMs: number): void {
		if (!this.active) return;
		const bucket = this.samples.get(name);
		if (bucket) {
			bucket.push(durationMs);
			if (this.maxSamplesPerTiming !== undefined && bucket.length > this.maxSamplesPerTiming) {
				// Keep the most recent N — steady-state samples matter most.
				bucket.splice(0, bucket.length - this.maxSamplesPerTiming);
			}
		} else {
			this.samples.set(name, [durationMs]);
		}
	}

	recordMany(samples: Iterable<readonly [name: string, durationMs: number]>): void {
		if (!this.active) return;
		for (const [name, durationMs] of samples) {
			this.record(name, durationMs);
		}
	}

	mark(name: string): void {
		if (!this.active || !this.emitMarks) return;
		if (typeof performance !== "undefined" && typeof performance.mark === "function") {
			performance.mark(name);
		}
	}

	increment(name: string, by = 1): void {
		if (!this.active) return;
		this.counters.set(name, (this.counters.get(name) ?? 0) + by);
	}

	setCounter(name: string, value: number): void {
		if (!this.active) return;
		this.counters.set(name, value);
	}

	snapshot(): PerfSnapshot {
		const timings: Record<string, PerfTimingSummary> = {};
		for (const [name, bucket] of this.samples) {
			timings[name] = summarizeSamples(bucket);
		}
		const counters: Record<string, number> = {};
		for (const [name, value] of this.counters) {
			counters[name] = value;
		}
		this.sequence += 1;
		return {
			schemaVersion: PERF_SNAPSHOT_SCHEMA_VERSION,
			sequence: this.sequence,
			createdAt: new Date().toISOString(),
			counters,
			timings,
		};
	}

	reset(): void {
		this.samples.clear();
		this.counters.clear();
	}
}

/** Create an isolated tracker — used by tests and per-bundle instrumentation. */
export function createPerfTracker(): PerfTracker {
	return new DefaultPerfTracker();
}

/**
 * Process-wide tracker. Each plugin bundles its own copy of this module, so the
 * singleton is scoped to a single plugin bundle — no cross-plugin contamination.
 * Sprinkle `perf.measure(...)` at stage boundaries without threading an instance
 * through constructors; the plugin entry point calls `perf.enable()` in stress
 * mode.
 */
export const perf: PerfTracker = createPerfTracker();
