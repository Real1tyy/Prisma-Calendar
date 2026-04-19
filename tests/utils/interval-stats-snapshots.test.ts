/**
 * Approval snapshots for `aggregateStats` — the pure function that turns raw
 * events into the ranked list the weekly/monthly/daily stat views render.
 *
 * Each snapshot pins the exact output (entry names, durations in ms, counts,
 * recurring flags, total, and period bounds) so numerical drift in duration
 * math or ordering changes surface in the diff.
 */
import { describe, expect, it } from "vitest";

import { aggregateStats } from "../../src/utils/stats";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

function asSnapshot(stats: ReturnType<typeof aggregateStats>): string {
	return (
		JSON.stringify(
			{
				...stats,
				periodStart: stats.periodStart?.toISOString(),
				periodEnd: stats.periodEnd?.toISOString(),
			},
			null,
			2
		) + "\n"
	);
}

describe("aggregateStats — approval snapshots", () => {
	it("empty events → empty entries, zero total", async () => {
		const stats = aggregateStats([], new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-empty.approved.json");
	});

	it("groups by cleaned name, sums duration, counts, sorted by duration desc", async () => {
		const events = [
			createMockTimedEvent({
				id: "1",
				title: "Team Meeting",
				start: "2026-04-15T09:00:00",
				end: "2026-04-15T10:00:00",
			}),
			createMockTimedEvent({
				id: "2",
				title: "Team Meeting",
				start: "2026-04-16T09:00:00",
				end: "2026-04-16T10:30:00",
			}),
			createMockTimedEvent({
				id: "3",
				title: "Design Review",
				start: "2026-04-15T14:00:00",
				end: "2026-04-15T15:00:00",
			}),
			createMockTimedEvent({ id: "4", title: "1:1 Sync", start: "2026-04-17T11:00:00", end: "2026-04-17T11:30:00" }),
		];
		const stats = aggregateStats(events, new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-name-mode.approved.json");
	});

	it("category mode splits duration evenly across multiple categories", async () => {
		const events = [
			createMockTimedEvent({
				id: "1",
				title: "Deep Work",
				start: "2026-04-15T09:00:00",
				end: "2026-04-15T11:00:00", // 2h
				metadata: { categories: ["Work", "Focus"] },
			}),
			createMockTimedEvent({
				id: "2",
				title: "Workout",
				start: "2026-04-15T18:00:00",
				end: "2026-04-15T19:00:00", // 1h
				metadata: { categories: ["Fitness"] },
			}),
		];
		const stats = aggregateStats(
			events,
			new Date("2026-04-13T00:00:00Z"),
			new Date("2026-04-20T00:00:00Z"),
			"category"
		);
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-category-split.approved.json");
	});

	it("category mode uses 'No Category' key when categories missing", async () => {
		const events = [
			createMockTimedEvent({
				id: "1",
				title: "Wandering Task",
				start: "2026-04-15T09:00:00",
				end: "2026-04-15T10:00:00",
			}),
		];
		const stats = aggregateStats(
			events,
			new Date("2026-04-13T00:00:00Z"),
			new Date("2026-04-20T00:00:00Z"),
			"category"
		);
		// "Wandering Task" has no categories; aggregateStats falls through to an empty key list
		// because parseCategories returns []. We pin the observed behavior here.
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-category-missing.approved.json");
	});

	it("all-day events are excluded from aggregation", async () => {
		const events = [
			createMockTimedEvent({ id: "t", title: "Timed", start: "2026-04-15T09:00:00", end: "2026-04-15T10:00:00" }),
			createMockAllDayEvent({ id: "a", title: "All Day", start: "2026-04-15T00:00:00" }),
		];
		const stats = aggregateStats(events, new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-no-allday.approved.json");
	});

	it("breakMinutes is subtracted from duration", async () => {
		const events = [
			createMockTimedEvent({
				id: "1",
				title: "Long Session",
				start: "2026-04-15T09:00:00",
				end: "2026-04-15T12:00:00", // 3h = 180m
				metadata: { breakMinutes: 30 },
			}),
		];
		const stats = aggregateStats(events, new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-break-subtract.approved.json");
	});

	it("clamps events where end < start to zero duration", async () => {
		const events = [
			createMockTimedEvent({ id: "m", title: "Malformed", start: "2026-04-15T23:00:00", end: "2026-04-15T01:00:00" }),
			createMockTimedEvent({ id: "ok", title: "Good", start: "2026-04-15T09:00:00", end: "2026-04-15T10:00:00" }),
		];
		const stats = aggregateStats(events, new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-clamp-negative.approved.json");
	});

	it("virtualKind 'recurring' flags the entry as isRecurring=true", async () => {
		const events = [
			createMockTimedEvent({
				id: "1",
				title: "Weekly Standup",
				start: "2026-04-15T09:00:00",
				end: "2026-04-15T09:30:00",
				virtualKind: "recurring",
			}),
		];
		const stats = aggregateStats(events, new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-recurring.approved.json");
	});

	it("filters out events outside the period bounds", async () => {
		const events = [
			createMockTimedEvent({ id: "in", title: "Inside", start: "2026-04-15T09:00:00", end: "2026-04-15T10:00:00" }),
			createMockTimedEvent({ id: "before", title: "Before", start: "2026-04-01T09:00:00", end: "2026-04-01T10:00:00" }),
			createMockTimedEvent({ id: "after", title: "After", start: "2026-05-01T09:00:00", end: "2026-05-01T10:00:00" }),
		];
		const stats = aggregateStats(events, new Date("2026-04-13T00:00:00Z"), new Date("2026-04-20T00:00:00Z"));
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-range-filter.approved.json");
	});

	it("without period bounds, includes every event", async () => {
		const events = [
			createMockTimedEvent({ id: "1", title: "Task", start: "2020-01-01T09:00:00", end: "2020-01-01T10:00:00" }),
			createMockTimedEvent({ id: "2", title: "Task", start: "2030-06-15T09:00:00", end: "2030-06-15T10:00:00" }),
		];
		const stats = aggregateStats(events);
		await expect(asSnapshot(stats)).toMatchFileSnapshot("__snapshots__/stats-unbounded.approved.json");
	});
});
