import { afterEach, describe, expect, it } from "vitest";

import { PrerequisiteTracker } from "../../src/core/prerequisite-tracker";
import type { Frontmatter } from "../../src/types/index";
import { buildTrackerHarness, type TrackerHarnessOptions } from "../fixtures/tracker-fixtures";

/**
 * Turns wiki-link targets (what `parseWikiLink` extracts from `[[X]]`) into file paths
 * under `Events/` — matches how MockVaultTable builds paths (`directory/key.md`).
 */
function linkResolver(linkPath: string): string | null {
	return `Events/${linkPath}.md`;
}

function buildTracker(options: TrackerHarnessOptions = {}) {
	return buildTrackerHarness(PrerequisiteTracker, {
		linkResolver,
		...options,
		settings: { prerequisiteProp: "Prerequisites", ...options.settings },
	});
}

describe("PrerequisiteTracker", () => {
	let tracker: PrerequisiteTracker | null = null;

	afterEach(() => {
		tracker?.destroy();
		tracker = null;
	});

	describe("graph construction", () => {
		it("is empty when no files have prerequisites", async () => {
			const { tracker: t } = await buildTracker({
				seed: [{ key: "a", data: { Title: "A" } as Frontmatter }],
			});
			tracker = t;

			expect(t.getPrerequisitesOf("Events/a.md")).toEqual([]);
			expect(t.getDependentsOf("Events/a.md")).toEqual([]);
			expect(t.isConnected("Events/a.md")).toBe(false);
		});

		it("records prerequisites declared in frontmatter", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "A" } as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;

			expect(t.getPrerequisitesOf("Events/b.md")).toEqual(["Events/a.md"]);
			expect(t.getDependentsOf("Events/a.md")).toEqual(["Events/b.md"]);
		});

		it("marks both prerequisite and dependent as connected", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: { Title: "A" } as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;

			expect(t.isConnected("Events/a.md")).toBe(true);
			expect(t.isConnected("Events/b.md")).toBe(true);
		});

		it("supports multiple prerequisites in a single file", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: {} as Frontmatter },
					{ key: "c", data: { Prerequisites: "[[a]], [[b]]" } as Frontmatter },
				],
			});
			tracker = t;

			expect(t.getPrerequisitesOf("Events/c.md").sort()).toEqual(["Events/a.md", "Events/b.md"]);
			expect(t.getDependentsOf("Events/a.md")).toEqual(["Events/c.md"]);
			expect(t.getDependentsOf("Events/b.md")).toEqual(["Events/c.md"]);
		});

		it("supports multiple dependents pointing at one file", async () => {
			const { tracker: t } = await buildTracker({
				seed: [
					{ key: "root", data: {} as Frontmatter },
					{ key: "a", data: { Prerequisites: "[[root]]" } as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[root]]" } as Frontmatter },
				],
			});
			tracker = t;

			expect(t.getDependentsOf("Events/root.md").sort()).toEqual(["Events/a.md", "Events/b.md"]);
		});
	});

	describe("incremental updates", () => {
		it("adds a new link when a dependent is created", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: {} as Frontmatter }],
			});
			tracker = t;
			expect(t.isConnected("Events/a.md")).toBe(false);

			await table.create({ fileName: "b", data: { Prerequisites: "[[a]]" } as Frontmatter });

			expect(t.getDependentsOf("Events/a.md")).toEqual(["Events/b.md"]);
			expect(t.isConnected("Events/a.md")).toBe(true);
		});

		it("updates links when prerequisites change", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: {} as Frontmatter },
					{ key: "c", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;
			expect(t.getDependentsOf("Events/a.md")).toEqual(["Events/c.md"]);
			expect(t.getDependentsOf("Events/b.md")).toEqual([]);

			await table.replace("c", { Prerequisites: "[[b]]" } as Frontmatter);

			expect(t.getDependentsOf("Events/a.md")).toEqual([]);
			expect(t.getDependentsOf("Events/b.md")).toEqual(["Events/c.md"]);
		});

		it("clears dependency when prerequisites are removed", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;
			expect(t.getDependentsOf("Events/a.md")).toEqual(["Events/b.md"]);

			await table.replace("b", {} as Frontmatter);

			expect(t.getDependentsOf("Events/a.md")).toEqual([]);
			expect(t.getPrerequisitesOf("Events/b.md")).toEqual([]);
			expect(t.isConnected("Events/a.md")).toBe(false);
		});
	});

	describe("deletion", () => {
		it("removes the deleted file's own prerequisites", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;

			await table.delete("b");

			expect(t.getPrerequisitesOf("Events/b.md")).toEqual([]);
			expect(t.getDependentsOf("Events/a.md")).toEqual([]);
		});

		it("cleans up dangling refs from other files' prerequisite lists", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]" } as Frontmatter },
					{ key: "c", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;

			await table.delete("a");

			expect(t.getPrerequisitesOf("Events/b.md")).toEqual([]);
			expect(t.getPrerequisitesOf("Events/c.md")).toEqual([]);
		});

		it("keeps surviving prerequisites when one is deleted from a multi-prereq list", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: {} as Frontmatter },
					{ key: "c", data: { Prerequisites: "[[a]], [[b]]" } as Frontmatter },
				],
			});
			tracker = t;

			await table.delete("a");

			expect(t.getPrerequisitesOf("Events/c.md")).toEqual(["Events/b.md"]);
		});

		it("marks file as disconnected when its last edge is removed", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;
			expect(t.isConnected("Events/a.md")).toBe(true);

			await table.delete("b");

			expect(t.isConnected("Events/a.md")).toBe(false);
		});
	});

	describe("observable", () => {
		it("emits an updated graph when prerequisites change", async () => {
			const { tracker: t, table } = await buildTracker({
				seed: [{ key: "a", data: {} as Frontmatter }],
			});
			tracker = t;

			const emissions: number[] = [];
			t.graph$.subscribe((g) => emissions.push(g.size));

			await table.create({ fileName: "b", data: { Prerequisites: "[[a]]" } as Frontmatter });

			expect(emissions.at(-1)).toBe(1);
		});
	});

	describe("settings changes", () => {
		it("rebuilds graph when prerequisiteProp changes", async () => {
			const { tracker: t, settingsStore } = await buildTracker({
				settings: { prerequisiteProp: "Prerequisites" },
				seed: [
					{ key: "a", data: {} as Frontmatter },
					{ key: "b", data: { Prerequisites: "[[a]]", OtherProp: "[[a]]" } as Frontmatter },
				],
			});
			tracker = t;
			expect(t.getPrerequisitesOf("Events/b.md")).toEqual(["Events/a.md"]);

			settingsStore.next({ ...settingsStore.value, prerequisiteProp: "OtherProp" });

			// rebuildAll() works from eventStore.getAllEvents(); our stub returns [], so
			// the graph is cleared on prop change. The test verifies the rebuild ran.
			expect(t.getGraph().size).toBe(0);
		});
	});
});
