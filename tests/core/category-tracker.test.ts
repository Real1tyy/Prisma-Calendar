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
					{ key: "a", data: { Category: "Work" } as Frontmatter },
					{ key: "b", data: { Category: "Fitness" } as Frontmatter },
					{ key: "c", data: { Category: "Personal" } as Frontmatter },
				],
			});
			tracker = t;

			expect(t.getCategories()).toEqual(["Fitness", "Personal", "Work"]);
		});

		it("supports multi-value categories (array)", async () => {
			const { tracker: t } = await buildTracker({
				seed: [{ key: "a", data: { Category: ["Work", "Urgent"] } as Frontmatter }],
			});
			tracker = t;

			expect(t.getCategories()).toEqual(["Urgent", "Work"]);
		});

		it("returns files grouped correctly via getAllFilesWithCategories", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Category: "Work" } as Frontmatter },
					{ key: "b", data: { Title: "No category" } as Frontmatter },
					{ key: "c", data: { Category: "Work" } as Frontmatter },
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

			await table.create({ fileName: "a", data: { Category: "Work" } as Frontmatter });

			expect(t.getCategories()).toEqual(["Work"]);
		});

		it("removes category when last file with it is deleted", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: { Category: "Work" } as Frontmatter }],
			});
			tracker = t;
			expect(t.getCategories()).toEqual(["Work"]);

			await table.delete("a");

			expect(t.getCategories()).toEqual([]);
		});

		it("emits updated categories on categories$ observable", async () => {
			const { tracker: t, table } = await buildTracker();
			tracker = t;
			const emitted: string[][] = [];
			t.categories$.subscribe((cats) => emitted.push(cats.map((c) => c.name)));

			await table.create({ fileName: "a", data: { Category: "Work" } as Frontmatter });
			await table.create({ fileName: "b", data: { Category: "Fitness" } as Frontmatter });

			expect(emitted.at(-1)).toEqual(["Fitness", "Work"]);
		});
	});

	describe("color resolution", () => {
		it("falls back to defaultNodeColor when no rule matches", async () => {
			const { tracker: t } = await buildTracker({
				settings: { defaultNodeColor: "#abcdef" },
				seed: [{ key: "a", data: { Category: "Work" } as Frontmatter }],
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
				seed: [{ key: "a", data: { Category: "Work" } as Frontmatter }],
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
				seed: [{ key: "a", data: { Category: "Work" } as Frontmatter }],
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
		it("returns events from EventStore for files in the category group", async () => {
			const events = new Map<string, CalendarEvent>([
				["Events/a.md", createMockTimedEvent({ ref: { filePath: "Events/a.md" }, title: "A" })],
				["Events/b.md", createMockTimedEvent({ ref: { filePath: "Events/b.md" }, title: "B" })],
			]);
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Category: "Work" } as Frontmatter },
					{ key: "b", data: { Category: "Work" } as Frontmatter },
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

		it("filters out files whose events are missing from EventStore", async () => {
			const events = new Map<string, CalendarEvent>();
			const { tracker: t } = await buildTracker({
				seed: [{ key: "a", data: { Category: "Work" } as Frontmatter }],
				events,
			});
			tracker = t;

			expect(t.getEventsWithCategory("Work")).toEqual([]);
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
					{ key: "a", data: { Category: "Work" } as Frontmatter },
					{ key: "b", data: { Category: "Work" } as Frontmatter },
					{ key: "c", data: { Category: "Work" } as Frontmatter },
				],
				events,
			});
			tracker = t;

			expect(t.getCategoryStats("Work")).toEqual({ total: 3, timed: 2, allDay: 1 });
		});
	});

	describe("settings changes", () => {
		it("rebuilds groups when categoryProp changes", async () => {
			const { tracker: t, settingsStore } = await buildTracker({
				settings: { categoryProp: "Category" },
				seed: [
					{ key: "a", data: { Category: "Work", Tags: "urgent" } as Frontmatter },
					{ key: "b", data: { Category: "Fitness", Tags: "routine" } as Frontmatter },
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
				seed: [{ key: "a", data: { Category: "Work" } as Frontmatter }],
			});

			let completed = false;
			t.categories$.subscribe({ complete: () => (completed = true) });

			t.destroy();
			expect(completed).toBe(true);
		});
	});
});
