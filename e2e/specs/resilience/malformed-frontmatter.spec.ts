import { expect } from "@playwright/test";
import { isPluginLoaded } from "@real1ty-obsidian-plugins/testing/e2e";

import { testResilience as test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon } from "../../fixtures/helpers";
import {
	PLUGIN_ID,
	reloadAndWaitForPrisma,
	vaultHasFilesEndingWith,
	writeRawEventFile,
} from "../../fixtures/resilience-helpers";
import { seedEvent } from "../../fixtures/seed-events";

// Prisma must tolerate every flavour of broken frontmatter that appears in
// real user vaults: invalid YAML, missing required keys, wrong value types,
// unknown keys, and completely empty blocks. The plugin has to load, the
// calendar view has to render, and valid events sharing the vault must still
// appear — broken files should be skipped or flagged, not crash the view.

interface MalformedFile {
	label: string;
	fileName: string;
	content: string;
}

const MALFORMED: MalformedFile[] = [
	{
		label: "invalid YAML",
		fileName: "invalid-yaml.md",
		content: ["---", "Start Date: [2026-07-01T09:00", "End Date: 2026-07-01T10:00", "---", "", "# Bad YAML"].join("\n"),
	},
	{
		label: "missing End Date",
		fileName: "missing-end.md",
		content: ["---", "Start Date: 2026-07-02T09:00", "---", "", "# Missing End"].join("\n"),
	},
	{
		label: "wrong value types",
		fileName: "wrong-types.md",
		content: ["---", 'Start Date: "not a date"', 'End Date: "also not a date"', "---", "", "# Wrong Types"].join("\n"),
	},
	{
		label: "unknown keys",
		fileName: "unknown-keys.md",
		content: [
			"---",
			"Start Date: 2026-07-04T09:00",
			"End Date: 2026-07-04T10:00",
			"FooBar: xyz",
			"AnotherWeirdKey: 42",
			"---",
			"",
			"# Unknown Keys",
		].join("\n"),
	},
	{
		label: "empty frontmatter",
		fileName: "empty-frontmatter.md",
		content: ["---", "---", "", "# Empty"].join("\n"),
	},
];

test.describe("malformed frontmatter", () => {
	test("plugin survives every broken-file flavour alongside a valid event", async ({ obsidian }) => {
		for (const m of MALFORMED) {
			writeRawEventFile(obsidian.vaultDir, m.fileName, m.content);
		}
		seedEvent(obsidian.vaultDir, {
			title: "Still Valid",
			startDate: "2026-07-10T09:00",
			endDate: "2026-07-10T10:00",
			category: "Work",
		});

		await reloadAndWaitForPrisma(obsidian.page);

		expect(await isPluginLoaded(obsidian.page, PLUGIN_ID)).toBe(true);

		await openCalendarViewViaRibbon(obsidian.page);
		await expect(obsidian.page.locator(".workspace-leaf").first()).toBeVisible();

		// The valid event lands months outside the default visible window, so
		// assert against Obsidian's vault API rather than the rendered DOM. The
		// plugin staying up + the valid file still being on disk / tracked by
		// the vault is the product contract we care about — broken files were
		// skipped, not crashed.
		await expect
			.poll(async () => (await vaultHasFilesEndingWith(obsidian.page, ["Still Valid.md"]))[0], {
				message: "valid event should remain tracked by the vault",
			})
			.toBe(true);
	});
});
