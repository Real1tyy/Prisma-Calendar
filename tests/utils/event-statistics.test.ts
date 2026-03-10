import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { calculateEventStatistics } from "../../src/utils/event-statistics";

describe("calculateEventStatistics", () => {
	const now = DateTime.fromISO("2026-02-15T12:00:00", { zone: "utc" });

	describe("basic statistics", () => {
		it("should calculate total, past, skipped, and completed", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-12", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-13", { zone: "utc" }), skipped: true },
				{ date: DateTime.fromISO("2026-02-14", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-16", { zone: "utc" }), skipped: false }, // future
				{ date: DateTime.fromISO("2026-02-20", { zone: "utc" }), skipped: false }, // future
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
			expect(stats.skipped).toBe(0);
			expect(stats.completed).toBe(0);
			expect(stats.completedPercentage).toBe("0.0");
		});
	});

	describe("time-based breakdowns", () => {
		it("should calculate this year, month, and week", () => {
			const items = [
				// This week (Feb 10-16, 2026)
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-14", { zone: "utc" }), skipped: false },

				// This month but not this week
				{ date: DateTime.fromISO("2026-02-05", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-08", { zone: "utc" }), skipped: false },

				// This year but not this month
				{ date: DateTime.fromISO("2026-01-15", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2025-12-20", { zone: "utc" }), skipped: false }, // last year
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.thisWeek).toBe(2);
			expect(stats.thisMonth).toBe(4);
			expect(stats.thisYear).toBe(5);
		});

		it("should handle events only in current week", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-11", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-14", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.thisWeek).toBe(3);
			expect(stats.thisMonth).toBe(3);
			expect(stats.thisYear).toBe(3);
		});
	});

	describe("frequency calculation", () => {
		it("should calculate daily frequency (multiple per day)", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-01", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-02", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-03", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-04", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-05", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-06", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-07", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-08", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-09", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-11", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-12", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-13", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-14", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.frequency).toContain("x/day");
		});

		it("should calculate weekly frequency (multiple per week)", () => {
			const items = [
				{ date: DateTime.fromISO("2026-01-05", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-08", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-12", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-15", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-19", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-22", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-26", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-01-29", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.frequency).toContain("x/week");
			expect(stats.frequency).not.toContain("x/day");
		});

		it("should calculate monthly frequency (less than weekly)", () => {
			const items = [
				{ date: DateTime.fromISO("2025-06-15", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2025-08-20", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2025-10-18", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2025-12-22", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.frequency).toContain("x/month");
		});

		it("should return empty string for less than 2 past events", () => {
			const items = [{ date: DateTime.fromISO("2026-02-10", { zone: "utc" }), skipped: false }];

			const stats = calculateEventStatistics(items, now);

			expect(stats.frequency).toBe("");
		});

		it("should return empty string for no past events", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-16", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-20", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.frequency).toBe("");
		});

		it("should handle events on same day", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-10T08:00:00", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-10T14:00:00", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			// Should calculate frequency even for same day
			expect(stats.frequency).toBeTruthy();
		});
	});

	describe("edge cases", () => {
		it("should handle empty event list", () => {
			const stats = calculateEventStatistics([], now);

			expect(stats.total).toBe(0);
			expect(stats.past).toBe(0);
			expect(stats.skipped).toBe(0);
			expect(stats.completed).toBe(0);
			expect(stats.completedPercentage).toBe("0.0");
			expect(stats.thisYear).toBe(0);
			expect(stats.thisMonth).toBe(0);
			expect(stats.thisWeek).toBe(0);
			expect(stats.frequency).toBe("");
		});

		it("should handle all future events", () => {
			const items = [
				{ date: DateTime.fromISO("2026-03-01", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-04-01", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-05-01", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.total).toBe(3);
			expect(stats.past).toBe(0);
			expect(stats.thisYear).toBe(0);
			expect(stats.thisMonth).toBe(0);
			expect(stats.thisWeek).toBe(0);
			expect(stats.frequency).toBe("");
		});

		it("should handle mixed skipped and completed events", () => {
			const items = [
				{ date: DateTime.fromISO("2026-02-01", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-02", { zone: "utc" }), skipped: true },
				{ date: DateTime.fromISO("2026-02-03", { zone: "utc" }), skipped: false },
				{ date: DateTime.fromISO("2026-02-04", { zone: "utc" }), skipped: true },
				{ date: DateTime.fromISO("2026-02-05", { zone: "utc" }), skipped: false },
			];

			const stats = calculateEventStatistics(items, now);

			expect(stats.past).toBe(5);
			expect(stats.skipped).toBe(2);
			expect(stats.completed).toBe(3);
			expect(stats.completedPercentage).toBe("60.0");
		});
	});
});
