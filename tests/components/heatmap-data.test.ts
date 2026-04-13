import { describe, expect, it } from "vitest";

import { buildHeatmapDataset } from "../../src/components/heatmap/heatmap-data";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

describe("buildHeatmapDataset", () => {
	describe("empty input", () => {
		it("returns an empty dataset with zero thresholds", () => {
			const result = buildHeatmapDataset([]);

			expect(result.days.size).toBe(0);
			expect(result.minDate).toBe("");
			expect(result.maxDate).toBe("");
			expect(result.maxCount).toBe(0);
			expect(result.thresholds).toEqual([0, 0, 0]);
		});
	});

	describe("grouping", () => {
		it("groups events by ISO date", () => {
			const events = [
				createMockTimedEvent({ id: "a", start: "2026-04-15T09:00:00" }),
				createMockTimedEvent({ id: "b", start: "2026-04-15T14:00:00" }),
				createMockTimedEvent({ id: "c", start: "2026-04-16T10:00:00" }),
			];

			const { days } = buildHeatmapDataset(events);

			expect(days.size).toBe(2);
			expect(days.get("2026-04-15")?.count).toBe(2);
			expect(days.get("2026-04-16")?.count).toBe(1);
		});

		it("groups all-day events alongside timed events on the same date", () => {
			const events = [
				createMockAllDayEvent({ id: "a", start: "2026-04-15T00:00:00" }),
				createMockTimedEvent({ id: "b", start: "2026-04-15T10:00:00" }),
			];

			const { days } = buildHeatmapDataset(events);

			expect(days.get("2026-04-15")?.count).toBe(2);
			expect(days.get("2026-04-15")?.events).toHaveLength(2);
		});

		it("skips events whose start produces no ISO date", () => {
			const events = [
				createMockTimedEvent({ id: "valid", start: "2026-04-15T10:00:00" }),
				createMockTimedEvent({ id: "invalid", start: "" }),
			];

			const { days } = buildHeatmapDataset(events);

			expect(days.size).toBe(1);
			expect(days.has("2026-04-15")).toBe(true);
		});
	});

	describe("min/max date tracking", () => {
		it("reports the earliest and latest dates seen", () => {
			const events = [
				createMockTimedEvent({ id: "mid", start: "2026-04-15T10:00:00" }),
				createMockTimedEvent({ id: "early", start: "2026-02-01T10:00:00" }),
				createMockTimedEvent({ id: "late", start: "2026-12-31T10:00:00" }),
				createMockTimedEvent({ id: "mid2", start: "2026-06-15T10:00:00" }),
			];

			const { minDate, maxDate } = buildHeatmapDataset(events);

			expect(minDate).toBe("2026-02-01");
			expect(maxDate).toBe("2026-12-31");
		});

		it("collapses to one date when all events share it", () => {
			const events = [
				createMockTimedEvent({ id: "a", start: "2026-04-15T09:00:00" }),
				createMockTimedEvent({ id: "b", start: "2026-04-15T14:00:00" }),
			];

			const { minDate, maxDate } = buildHeatmapDataset(events);

			expect(minDate).toBe("2026-04-15");
			expect(maxDate).toBe("2026-04-15");
		});
	});

	describe("maxCount", () => {
		it("reports the busiest day's count", () => {
			const busy = Array.from({ length: 5 }, (_, i) =>
				createMockTimedEvent({ id: `busy-${i}`, start: "2026-04-15T10:00:00" })
			);
			const quiet = createMockTimedEvent({ id: "quiet", start: "2026-04-16T10:00:00" });

			const { maxCount } = buildHeatmapDataset([...busy, quiet]);

			expect(maxCount).toBe(5);
		});

		it("is 1 for a single event", () => {
			const { maxCount } = buildHeatmapDataset([createMockTimedEvent({ start: "2026-04-15T10:00:00" })]);
			expect(maxCount).toBe(1);
		});
	});

	describe("quantile thresholds", () => {
		it("collapses to [n, n, n] when every active day has the same count", () => {
			const events = [
				createMockTimedEvent({ id: "a", start: "2026-04-15T10:00:00" }),
				createMockTimedEvent({ id: "b", start: "2026-04-16T10:00:00" }),
				createMockTimedEvent({ id: "c", start: "2026-04-17T10:00:00" }),
			];

			const { thresholds } = buildHeatmapDataset(events);

			expect(thresholds).toEqual([1, 1, 1]);
		});

		it("produces a non-decreasing quantile sequence", () => {
			// Days with counts [1, 2, 3, 4, 5, 6, 7, 8] — sorted, so quantiles are well-defined.
			const events: Parameters<typeof buildHeatmapDataset>[0] = [];
			for (let day = 1; day <= 8; day++) {
				const dayKey = `2026-04-${String(day + 10).padStart(2, "0")}T10:00:00`;
				for (let i = 0; i < day; i++) {
					events.push(createMockTimedEvent({ id: `d${day}-${i}`, start: dayKey }));
				}
			}

			const { thresholds } = buildHeatmapDataset(events);

			expect(thresholds[0]).toBeLessThanOrEqual(thresholds[1]);
			expect(thresholds[1]).toBeLessThanOrEqual(thresholds[2]);
			expect(thresholds[2]).toBeLessThanOrEqual(8);
		});

		it("excludes zero-count days (days without events don't bias thresholds)", () => {
			// A single heavy day — thresholds reflect only active days.
			const events = Array.from({ length: 10 }, (_, i) =>
				createMockTimedEvent({ id: `e${i}`, start: "2026-04-15T10:00:00" })
			);

			const { thresholds, maxCount } = buildHeatmapDataset(events);

			expect(maxCount).toBe(10);
			// Only one active day with count=10, so every quantile collapses to 10.
			expect(thresholds).toEqual([10, 10, 10]);
		});
	});
});
