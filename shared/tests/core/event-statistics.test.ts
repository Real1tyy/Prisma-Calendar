import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { calculateEventStatistics } from "../../src/core/event-statistics";

describe("calculateEventStatistics", () => {
	const now = DateTime.fromISO("2026-02-15T12:00:00", { zone: "utc" });

	describe("basic statistics", () => {
		it("should calculate total, past, skipped, and completed", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-12", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-13", { zone: "utc" }), skipped: true },
				{ date: DateTime.fromISO("2026-02-14", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-16", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-20", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.total).toBe(6);
			expect(stats.past).toBe(4);
			expect(stats.skipped).toBe(1);
			expect(stats.completed).toBe(3);
			expect(stats.completedPercentage).toBe("75.0");
		});

		it("should handle all skipped events", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: true },
				{ date: DateTime.fromISO("2026-02-12", { zone: "utc" }), skipped: true },
			];

			const stats = calculateEventStatistics(items, now);
			expect(stats.completed).toBe(0);
			expect(stats.completedPercentage).toBe("0.0");
		});

		it("should handle no past events", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-16", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-20", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);
			expect(stats.past).toBe(0);
			expect(stats.completedPercentage).toBe("0.0");
		});
	});

	describe("time-based breakdowns", () => {
		it("should calculate this year, month, and week", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-14", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-05", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-08", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-15", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2025-12-20", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.thisWeek).toBe(2);
			expect(stats.thisMonth).toBe(4);
			expect(stats.thisYear).toBe(5);
		});
	});

	describe("frequency calculation", () => {
		it("should calculate daily frequency", () => {
			const items = Array.from({ length: 14 }, (_, i) => ({
				date: DateTime.fromISO(`2026-02-${String(i + 1).padStart(2, "0")}`, { zone: "utc" }),
				skipped: false,
			}));

			const stats = calculateEventStatistics(items, now);
			expect(stats.frequency).toContain("x/day");
		});

		it("should return empty string for less than 2 past events", () => {
			const items = [{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false }];
			const stats = calculateEventStatistics(items, now);
			expect(stats.frequency).toBe("");
		});
	});

	describe("edge cases", () => {
		it("should handle empty event list", () => {
			const stats = calculateEventStatistics([], now);

			expect(stats.total).toBe(0);
			expect(stats.past).toBe(0);
			expect(stats.frequency).toBe("");
		});
	});
});
