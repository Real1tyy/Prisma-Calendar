import { afterEach, describe, expect, it } from "vitest";

import { NameSeriesTracker } from "../../src/core/name-series-tracker";
import type { CalendarEvent } from "../../src/types/calendar";
import type { Frontmatter } from "../../src/types/index";
import { createMockTimedEvent } from "../fixtures/event-fixtures";
import { buildTrackerHarness, type TrackerHarnessOptions } from "../fixtures/tracker-fixtures";

function buildTracker(options: TrackerHarnessOptions = {}) {
	return buildTrackerHarness(NameSeriesTracker, {
		...options,
		settings: { titleProp: "Title", ...options.settings },
	});
}

describe("NameSeriesTracker", () => {
	let tracker: NameSeriesTracker | null = null;

	afterEach(() => {
		tracker?.destroy();
		tracker = null;
	});

	describe("name normalization", () => {
		it("groups files by lowercase title", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "Meeting" } as Frontmatter },
					{ key: "b", data: { Title: "MEETING" } as Frontmatter },
					{ key: "c", data: { Title: "meeting" } as Frontmatter },
				],
			});
			tracker = t;

			const map = t.getNameSeriesMap();
			expect(map.size).toBe(1);
			expect(map.has("meeting")).toBe(true);
			expect(map.get("meeting")?.size).toBe(3);
		});

		it("produces separate groups for different titles", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "Standup" } as Frontmatter },
					{ key: "b", data: { Title: "Review" } as Frontmatter },
				],
			});
			tracker = t;

			const map = t.getNameSeriesMap();
			expect(map.size).toBe(2);
			expect(map.has("standup")).toBe(true);
			expect(map.has("review")).toBe(true);
		});

		it("falls back to filename-derived key when title is empty", async () => {
			const { tracker: t } = await buildTracker({
				seed: [{ key: "lunch-meeting", data: { Title: "" } as Frontmatter }],
			});
			tracker = t;

			const map = t.getNameSeriesMap();
			expect(map.size).toBeGreaterThan(0);
		});
	});

	describe("getNameBasedSeries", () => {
		it("returns only groups with 2+ members", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "Meeting" } as Frontmatter },
					{ key: "b", data: { Title: "Meeting" } as Frontmatter },
					{ key: "c", data: { Title: "Solo" } as Frontmatter },
				],
			});
			tracker = t;

			const series = t.getNameBasedSeries();
			expect(series.size).toBe(1);
			expect(series.has("meeting")).toBe(true);
			expect(series.has("solo")).toBe(false);
		});

		it("is empty when every title is unique", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "One" } as Frontmatter },
					{ key: "b", data: { Title: "Two" } as Frontmatter },
				],
			});
			tracker = t;

			expect(t.getNameBasedSeries().size).toBe(0);
		});
	});

	describe("getEventsInNameSeries", () => {
		it("returns CalendarEvents from EventStore for files in the series", async () => {
			const events = new Map<string, CalendarEvent>([
				["Events/a.md", createMockTimedEvent({ ref: { filePath: "Events/a.md" }, title: "Meeting" })],
				["Events/b.md", createMockTimedEvent({ ref: { filePath: "Events/b.md" }, title: "Meeting" })],
			]);
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "Meeting" } as Frontmatter },
					{ key: "b", data: { Title: "Meeting" } as Frontmatter },
				],
				events,
			});
			tracker = t;

			const result = t.getEventsInNameSeries("meeting");
			expect(result).toHaveLength(2);
			expect(result.map((e) => e.ref.filePath).sort()).toEqual(["Events/a.md", "Events/b.md"]);
		});

		it("returns empty array for unknown name key", async () => {
			const { tracker: t } = await buildTracker();
			tracker = t;
			expect(t.getEventsInNameSeries("nonexistent")).toEqual([]);
		});
	});

	describe("vault changes", () => {
		it("adds a file to its group on create", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: { Title: "Meeting" } as Frontmatter }],
			});
			tracker = t;
			expect(t.getNameSeriesMap().get("meeting")?.size).toBe(1);

			await table.create({ fileName: "b", data: { Title: "MEETING" } as Frontmatter });

			expect(t.getNameSeriesMap().get("meeting")?.size).toBe(2);
		});

		it("moves a file to a new group when its title changes", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: { Title: "Standup" } as Frontmatter }],
			});
			tracker = t;
			expect(t.getNameSeriesMap().has("standup")).toBe(true);

			await table.update("a", { Title: "Review" });

			const map = t.getNameSeriesMap();
			expect(map.has("standup")).toBe(false);
			expect(map.get("review")?.size).toBe(1);
		});

		it("removes a file from its group on delete", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "Meeting" } as Frontmatter },
					{ key: "b", data: { Title: "Meeting" } as Frontmatter },
				],
			});
			tracker = t;
			expect(t.getNameSeriesMap().get("meeting")?.size).toBe(2);

			await table.delete("a");

			expect(t.getNameSeriesMap().get("meeting")?.size).toBe(1);
		});
	});

	describe("settings changes", () => {
		it("rebuilds groups when titleProp changes", async () => {
			const { tracker: t, settingsStore } = await buildTracker({
				settings: { titleProp: "Title" },
				seed: [
					{ key: "a", data: { Title: "One", Alt: "Two" } as Frontmatter },
					{ key: "b", data: { Title: "Three", Alt: "Two" } as Frontmatter },
				],
			});
			tracker = t;
			expect(t.getNameBasedSeries().size).toBe(0);

			settingsStore.next({ ...settingsStore.value, titleProp: "Alt" });

			expect(t.getNameBasedSeries().get("two")?.size).toBe(2);
		});
	});
});
