import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPerfTracker } from "../../src/perf/tracker";

describe("PerfTracker", () => {
	let now = 0;

	beforeEach(() => {
		now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => now);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("when disabled (default)", () => {
		it("passes through the synchronous result without recording", () => {
			const tracker = createPerfTracker();
			const result = tracker.measure("stage", () => {
				now = 100;
				return 42;
			});
			expect(result).toBe(42);
			expect(tracker.snapshot().timings).toEqual({});
		});

		it("passes through the async result without recording", async () => {
			const tracker = createPerfTracker();
			const result = await tracker.measureAsync("stage", async () => "value");
			expect(result).toBe("value");
			expect(tracker.snapshot().timings).toEqual({});
		});

		it("ignores counters", () => {
			const tracker = createPerfTracker();
			tracker.increment("events");
			tracker.setCounter("views", 3);
			expect(tracker.snapshot().counters).toEqual({});
		});
	});

	describe("when enabled", () => {
		it("records a synchronous stage duration", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			const result = tracker.measure("stage", () => {
				now = 5;
				return "ok";
			});
			expect(result).toBe("ok");
			expect(tracker.snapshot().timings["stage"]).toEqual({
				count: 1,
				totalMs: 5,
				avgMs: 5,
				minMs: 5,
				maxMs: 5,
				p50Ms: 5,
				p95Ms: 5,
			});
		});

		it("records an async stage duration via the returned promise", async () => {
			const tracker = createPerfTracker();
			tracker.enable();
			const result = await tracker.measureAsync("async-stage", async () => {
				now = 8;
				return 1;
			});
			expect(result).toBe(1);
			expect(tracker.snapshot().timings["async-stage"]?.totalMs).toBe(8);
		});

		it("still records when the synchronous fn throws", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			expect(() =>
				tracker.measure("boom", () => {
					now = 3;
					throw new Error("boom");
				})
			).toThrow("boom");
			expect(tracker.snapshot().timings["boom"]?.count).toBe(1);
		});

		it("aggregates repeated samples under one name", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			tracker.record("nav", 10);
			tracker.record("nav", 20);
			tracker.record("nav", 30);
			expect(tracker.snapshot().timings["nav"]).toMatchObject({
				count: 3,
				totalMs: 60,
				avgMs: 20,
				minMs: 10,
				maxMs: 30,
			});
		});

		it("accumulates and sets counters", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			tracker.increment("events");
			tracker.increment("events", 4);
			tracker.setCounter("views", 2);
			expect(tracker.snapshot().counters).toEqual({ events: 5, views: 2 });
		});

		it("reset clears timings and counters", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			tracker.record("nav", 10);
			tracker.increment("events");
			tracker.reset();
			const snapshot = tracker.snapshot();
			expect(snapshot.timings).toEqual({});
			expect(snapshot.counters).toEqual({});
		});

		it("stops recording after disable()", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			tracker.record("a", 1);
			tracker.disable();
			tracker.record("b", 2);
			expect(Object.keys(tracker.snapshot().timings)).toEqual(["a"]);
		});

		it("records many samples at once", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			tracker.recordMany([
				["a", 10],
				["a", 20],
				["b", 5],
			]);
			const snapshot = tracker.snapshot();
			expect(snapshot.timings["a"]?.count).toBe(2);
			expect(snapshot.timings["b"]?.count).toBe(1);
		});

		it("caps retained samples to maxSamplesPerTiming, keeping the most recent", () => {
			const tracker = createPerfTracker();
			tracker.enable({ maxSamplesPerTiming: 2 });
			tracker.record("nav", 1);
			tracker.record("nav", 2);
			tracker.record("nav", 3);
			expect(tracker.snapshot().timings["nav"]).toMatchObject({ count: 2, minMs: 2, maxMs: 3 });
		});

		it("emits a snapshot envelope with schemaVersion and an incrementing sequence", () => {
			const tracker = createPerfTracker();
			tracker.enable();
			const first = tracker.snapshot();
			const second = tracker.snapshot();
			expect(first.schemaVersion).toBe(1);
			expect(first.sequence).toBe(1);
			expect(second.sequence).toBe(2);
		});

		it("only emits user-timing marks when the option is set", () => {
			const markSpy = vi.spyOn(performance, "mark").mockImplementation(() => ({}) as PerformanceMark);

			const off = createPerfTracker();
			off.enable();
			off.mark("x");
			expect(markSpy).not.toHaveBeenCalled();

			const on = createPerfTracker();
			on.enable({ emitUserTimingMarks: true });
			on.mark("x");
			expect(markSpy).toHaveBeenCalledTimes(1);
		});
	});
});
