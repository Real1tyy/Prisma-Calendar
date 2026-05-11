import { afterEach, describe, expect, it } from "vitest";

import { CategoryTracker } from "../../src/core/category-tracker";
import type { CalendarEvent } from "../../src/types/calendar";
import type { Frontmatter, SingleCalendarConfig } from "../../src/types/index";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";
import { buildTrackerHarness, type TrackerHarnessOptions } from "../fixtures/tracker-fixtures";

function buildTracker(options: TrackerHarnessOptions = {}) {
	return buildTrackerHarness(CategoryTracker, {
		...options,
		settings: { categoryProp: "Category", ...options.settings },
	});
}

// Frontmatter shorthands that mirror how the indexer sees timed/all-day/untracked rows.
// Classification in CategoryTracker reads "Start Date" / "Date" directly off frontmatter.
function timedRow(category: string | string[]): Frontmatter {
	return { Category: category, "Start Date": "2026-05-07T09:00:00", "End Date": "2026-05-07T10:00:00" } as Frontmatter;
}

function allDayRow(category: string | string[]): Frontmatter {
	return { Category: category, Date: "2026-05-07" } as Frontmatter;
}

function untrackedRow(category: string | string[]): Frontmatter {
	return { Category: category } as Frontmatter;
}

describe("CategoryTracker", () => {
	let tracker: CategoryTracker | null = null;

	afterEach(() => {
		tracker?.destroy();
		tracker = null;
	});

	describe("initial grouping", () => {
		it("is empty when no rows have categories", async () => {
			const { tracker: t } = await buildTracker({
				seed: [{ key: "a", data: { Title: "Just A" } as Frontmatter }],
			});
			tracker = t;

			expect(t.getCategories()).toEqual([]);
			expect(t.getCategoriesWithColors()).toEqual([]);
		});

		it("groups files by category with categories sorted alphabetically", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: timedRow("Work") },
					{ key: "b", data: timedRow("Fitness") },
					{ key: "c", data: timedRow("Personal") },
				],
			});
			tracker = t;

			expect(t.getCategories()).toEqual(["Fitness", "Personal", "Work"]);
		});

		it("supports multi-value categories (array)", async () => {
			const { tracker: t } = await buildTracker({
				seed: [{ key: "a", data: timedRow(["Work", "Urgent"]) }],
			});
			tracker = t;

			expect(t.getCategories()).toEqual(["Urgent", "Work"]);
		});

		it("returns files grouped correctly via getAllFilesWithCategories", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: timedRow("Work") },
					{ key: "b", data: { Title: "No category" } as Frontmatter },
					{ key: "c", data: timedRow("Work") },
				],
			});
			tracker = t;

			const files = t.getAllFilesWithCategories();
			expect(files.size).toBe(2);
			expect(files.has("Events/a.md")).toBe(true);
			expect(files.has("Events/c.md")).toBe(true);
		});
	});

	describe("reacts to vault changes", () => {
		it("updates grouping when a row is created", async () => {
			const { tracker: t, table } = await buildTracker();
			tracker = t;
			expect(t.getCategories()).toEqual([]);

			await table.create({ fileName: "a", data: timedRow("Work") });

			expect(t.getCategories()).toEqual(["Work"]);
		});

		it("removes category when last file with it is deleted", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: timedRow("Work") }],
			});
			tracker = t;
			expect(t.getCategories()).toEqual(["Work"]);

			await table.delete("a");

			expect(t.getCategories()).toEqual([]);
		});

		it("re-classifies when a row flips from untracked to timed", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: untrackedRow("Work") }],
			});
			tracker = t;
			expect(t.getCategoryStats("Work")).toEqual({ total: 1, timed: 0, allDay: 0, untracked: 1 });

			await table.update("a", timedRow("Work"));

			expect(t.getCategoryStats("Work")).toEqual({ total: 1, timed: 1, allDay: 0, untracked: 0 });
		});

		it("emits updated categories on categories$ observable", async () => {
			const { tracker: t, table } = await buildTracker();
			tracker = t;
			const emitted: string[][] = [];
			t.categories$.subscribe((cats) => emitted.push(cats.map((c) => c.name)));

			await table.create({ fileName: "a", data: timedRow("Work") });
			await table.create({ fileName: "b", data: timedRow("Fitness") });

			expect(emitted.at(-1)).toEqual(["Fitness", "Work"]);
		});
	});

	describe("color resolution", () => {
		it("falls back to defaultNodeColor when no rule matches", async () => {
			const { tracker: t } = await buildTracker({
				settings: { defaultNodeColor: "#abcdef" },
				seed: [{ key: "a", data: timedRow("Work") }],
			});
			tracker = t;

			expect(t.getCategoryColor("Work")).toBe("#abcdef");
		});

		it("applies matching enabled color rule", async () => {
			const { tracker: t } = await buildTracker({
				settings: {
					defaultNodeColor: "#000000",
					colorRules: [
						{ expression: "Category.includes('Work')", color: "#ff0000", enabled: true },
					] as SingleCalendarConfig["colorRules"],
				},
				seed: [{ key: "a", data: timedRow("Work") }],
			});
			tracker = t;

			expect(t.getCategoryColor("Work")).toBe("#ff0000");
		});

		it("ignores disabled color rules", async () => {
			const { tracker: t } = await buildTracker({
				settings: {
					defaultNodeColor: "#000000",
					colorRules: [
						{ expression: "Category.includes('Work')", color: "#ff0000", enabled: false },
					] as SingleCalendarConfig["colorRules"],
				},
				seed: [{ key: "a", data: timedRow("Work") }],
			});
			tracker = t;

			expect(t.getCategoryColor("Work")).toBe("#000000");
		});

		it("ignores color rule when categoryProp is unset", async () => {
			const { tracker: t } = await buildTracker({
				settings: {
					categoryProp: undefined as unknown as string,
					defaultNodeColor: "#000000",
					colorRules: [
						{ expression: "Category.includes('Work')", color: "#ff0000", enabled: true },
					] as SingleCalendarConfig["colorRules"],
				},
			});
			tracker = t;

			expect(t.getCategoryColor("Work")).toBe("#000000");
		});
	});

	describe("getEventsWithCategory", () => {
		it("returns events from EventStore for tracked files in the category group", async () => {
			const events = new Map<string, CalendarEvent>([
				["Events/a.md", createMockTimedEvent({ ref: { filePath: "Events/a.md" }, title: "A" })],
				["Events/b.md", createMockTimedEvent({ ref: { filePath: "Events/b.md" }, title: "B" })],
			]);
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: timedRow("Work") },
					{ key: "b", data: timedRow("Work") },
				],
				events,
			});
			tracker = t;

			const workEvents = t.getEventsWithCategory("Work");
			expect(workEvents.map((e) => e.title).sort()).toEqual(["A", "B"]);
		});

		it("returns empty array for unknown category", async () => {
			const { tracker: t } = await buildTracker();
			tracker = t;
			expect(t.getEventsWithCategory("Nonexistent")).toEqual([]);
		});

		it("does not include untracked rows", async () => {
			// Only tracked rows hit EventStore; untracked rows live outside it.
			const events = new Map<string, CalendarEvent>([
				["Events/a.md", createMockTimedEvent({ ref: { filePath: "Events/a.md" }, title: "Tracked" })],
			]);
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: timedRow("Work") },
					{ key: "b", data: untrackedRow("Work") },
				],
				events,
			});
			tracker = t;

			expect(t.getEventsWithCategory("Work").map((e) => e.title)).toEqual(["Tracked"]);
		});
	});

	describe("getCategoryStats", () => {
		it("counts timed vs allDay events per category", async () => {
			const events = new Map<string, CalendarEvent>([
				["Events/a.md", createMockTimedEvent({ ref: { filePath: "Events/a.md" } })],
				["Events/b.md", createMockAllDayEvent({ ref: { filePath: "Events/b.md" } })],
				["Events/c.md", createMockTimedEvent({ ref: { filePath: "Events/c.md" } })],
			]);
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: timedRow("Work") },
					{ key: "b", data: allDayRow("Work") },
					{ key: "c", data: timedRow("Work") },
				],
				events,
			});
			tracker = t;

			expect(t.getCategoryStats("Work")).toEqual({ total: 3, timed: 2, allDay: 1, untracked: 0 });
		});

		it("counts untracked events when only untracked rows use the category", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: untrackedRow("OnlyUntracked") },
					{ key: "b", data: untrackedRow("OnlyUntracked") },
				],
			});
			tracker = t;

			expect(t.getCategoryStats("OnlyUntracked")).toEqual({ total: 2, timed: 0, allDay: 0, untracked: 2 });
		});

		it("sums tracked and untracked counts when both contribute to a category", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: timedRow("Mixed") },
					{ key: "b", data: allDayRow("Mixed") },
					{ key: "c", data: untrackedRow("Mixed") },
				],
			});
			tracker = t;

			expect(t.getCategoryStats("Mixed")).toEqual({ total: 3, timed: 1, allDay: 1, untracked: 1 });
		});

		it("returns zeros for an unknown category", async () => {
			const { tracker: t } = await buildTracker();
			tracker = t;
			expect(t.getCategoryStats("Nope")).toEqual({ total: 0, timed: 0, allDay: 0, untracked: 0 });
		});
	});

	describe("getFilePathsWithCategory", () => {
		it("returns paths for both tracked and untracked files (used by bulk rename/delete)", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "tracked", data: timedRow("Work") },
					{ key: "untracked", data: untrackedRow("Work") },
				],
			});
			tracker = t;

			expect(t.getFilePathsWithCategory("Work").sort()).toEqual(["Events/tracked.md", "Events/untracked.md"]);
		});

		it("returns empty array for unknown category", async () => {
			const { tracker: t } = await buildTracker();
			tracker = t;
			expect(t.getFilePathsWithCategory("Nope")).toEqual([]);
		});
	});

	describe("getUntrackedFilePathsWithCategory", () => {
		it("returns only untracked file paths under the category", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "tracked", data: timedRow("Work") },
					{ key: "untracked-1", data: untrackedRow("Work") },
					{ key: "untracked-2", data: untrackedRow("Work") },
				],
			});
			tracker = t;

			expect(t.getUntrackedFilePathsWithCategory("Work").sort()).toEqual([
				"Events/untracked-1.md",
				"Events/untracked-2.md",
			]);
		});
	});

	describe("settings changes", () => {
		it("rebuilds groups when categoryProp changes", async () => {
			const { tracker: t, settingsStore } = await buildTracker({
				settings: { categoryProp: "Category" },
				seed: [
					{ key: "a", data: { Category: "Work", Tags: "urgent", "Start Date": "2026-05-07T09:00:00" } as Frontmatter },
					{
						key: "b",
						data: { Category: "Fitness", Tags: "routine", "Start Date": "2026-05-07T10:00:00" } as Frontmatter,
					},
				],
			});
			tracker = t;
			expect(t.getCategories()).toEqual(["Fitness", "Work"]);

			settingsStore.next({ ...settingsStore.value, categoryProp: "Tags" });

			expect(t.getCategories()).toEqual(["routine", "urgent"]);
		});
	});

	describe("destroy", () => {
		it("cleans up subscriptions and completes categories$", async () => {
			const { tracker: t } = await buildTracker({
				seed: [{ key: "a", data: timedRow("Work") }],
			});

			let completed = false;
			t.categories$.subscribe({ complete: () => (completed = true) });

			t.destroy();
			expect(completed).toBe(true);
		});
	});
});
