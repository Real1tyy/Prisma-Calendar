import { rmSync } from "node:fs";
import { join } from "node:path";

import { expect } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { testResilience as test } from "../../fixtures/electron";
import { reloadAndWaitForPrisma, seedEventFiles } from "../../fixtures/resilience-helpers";
import { seedEvent, type SeedEventInput } from "../../fixtures/seed-events";
import { listEventFiles } from "../events/events-helpers";

// Persistence barrier: every user-visible op must survive a full renderer
// reload. Each case seeds files on disk (standing in for the op's final
// persisted state — how the bytes got there doesn't matter at the reload
// boundary), reloads Prisma, and asserts the bytes are still there.

interface FrontmatterCheck {
	path: string;
	expect: Record<string, string>;
}

interface ReloadCase {
	name: string;
	seed: SeedEventInput[];
	/** Files/frontmatter that must be present after reload. */
	persists?: FrontmatterCheck[];
	/** Vault-relative paths (anywhere under Events/) that must remain absent. */
	absent?: string[];
	/** Vault-relative paths to unlink between the seed and the reload. */
	unlinkBeforeReload?: string[];
}

const CASES: ReloadCase[] = [
	{
		name: "create survives reload",
		seed: [{ title: "Created Before Reload", startDate: "2026-06-01T09:00", endDate: "2026-06-01T10:00" }],
		persists: [
			{
				path: "Events/Created Before Reload.md",
				expect: { "Start Date": "2026-06-01T09:00", "End Date": "2026-06-01T10:00" },
			},
		],
	},
	{
		name: "edit survives reload",
		seed: [{ title: "Edited Event", startDate: "2026-06-02T13:00", endDate: "2026-06-02T14:00" }],
		persists: [
			{
				path: "Events/Edited Event.md",
				expect: { "Start Date": "2026-06-02T13:00", "End Date": "2026-06-02T14:00" },
			},
		],
	},
	{
		name: "drag-reschedule survives reload",
		seed: [{ title: "Rescheduled", startDate: "2026-06-04T15:00", endDate: "2026-06-04T16:00" }],
		persists: [
			{
				path: "Events/Rescheduled.md",
				expect: { "Start Date": "2026-06-04T15:00", "End Date": "2026-06-04T16:00" },
			},
		],
	},
	{
		name: "resize survives reload",
		seed: [{ title: "Resized", startDate: "2026-06-05T09:00", endDate: "2026-06-05T12:30" }],
		persists: [{ path: "Events/Resized.md", expect: { "End Date": "2026-06-05T12:30" } }],
	},
	{
		name: "batch duplicate survives reload",
		seed: ["Duplicate A", "Duplicate B", "Duplicate C"].map((title, i) => ({
			title,
			startDate: `2026-06-10T${String(9 + i).padStart(2, "0")}:00`,
			endDate: `2026-06-10T${String(10 + i).padStart(2, "0")}:00`,
		})),
		persists: [
			{ path: "Events/Duplicate A.md", expect: {} },
			{ path: "Events/Duplicate B.md", expect: {} },
			{ path: "Events/Duplicate C.md", expect: {} },
		],
	},
	{
		name: "batch delete survives reload",
		seed: [{ title: "To Be Deleted", startDate: "2026-06-11T09:00", endDate: "2026-06-11T10:00" }],
		unlinkBeforeReload: ["Events/To Be Deleted.md"],
		absent: ["Events/To Be Deleted.md"],
	},
];

test.describe("reload persists events", () => {
	for (const tc of CASES) {
		test(tc.name, async ({ obsidian }) => {
			seedEventFiles(obsidian.vaultDir, tc.seed);

			for (const relative of tc.unlinkBeforeReload ?? []) {
				rmSync(join(obsidian.vaultDir, relative));
			}

			await reloadAndWaitForPrisma(obsidian.page);

			for (const check of tc.persists ?? []) {
				const fm = readEventFrontmatter(obsidian.vaultDir, check.path);
				for (const [key, value] of Object.entries(check.expect)) {
					expect(fm[key], `${check.path}:${key}`).toBe(value);
				}
			}

			if (tc.absent && tc.absent.length > 0) {
				const files = listEventFiles(obsidian.vaultDir);
				for (const relative of tc.absent) {
					expect(
						files.some((abs) => abs.endsWith(`/${relative}`)),
						relative
					).toBe(false);
				}
			}
		});
	}

	test("persists across successive edits", async ({ obsidian }) => {
		const relative = seedEvent(obsidian.vaultDir, {
			title: "Evolving",
			startDate: "2026-06-20T09:00",
			endDate: "2026-06-20T10:00",
		});
		seedEvent(obsidian.vaultDir, {
			title: "Evolving",
			startDate: "2026-06-20T13:00",
			endDate: "2026-06-20T14:00",
		});

		await reloadAndWaitForPrisma(obsidian.page);

		const fm = readEventFrontmatter(obsidian.vaultDir, relative);
		expect(fm["Start Date"]).toBe("2026-06-20T13:00");
		expect(fm["End Date"]).toBe("2026-06-20T14:00");
	});
});
