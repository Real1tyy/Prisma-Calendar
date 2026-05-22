import { readPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, test } from "../../fixtures/electron";
import {
	eventTileByTitle,
	sel,
	TOUR_NEXT_TID,
	TOUR_PROGRESS_TID,
	TOUR_SKIP_TID,
	TOUR_TOOLTIP_TID,
} from "../../fixtures/testids";

const TOUR_COMMAND = "Prisma Calendar: Start onboarding tutorial";
const SAMPLE_TILE = eventTileByTitle("Your first event");
const STEP_COUNT = 7;

function readTutorialCompleted(vaultDir: string): boolean | undefined {
	return (readPluginData(vaultDir, PLUGIN_ID) as { tutorialCompleted?: boolean }).tutorialCompleted;
}

test.describe("onboarding: interactive tutorial", () => {
	test("guided tour creates the sample event and records completion", async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		await calendar.runCommand(TOUR_COMMAND);

		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toBeVisible();
		await expect(page.locator(sel(TOUR_PROGRESS_TID))).toHaveText(`1 / ${STEP_COUNT}`);

		const next = page.locator(sel(TOUR_NEXT_TID));
		for (let step = 2; step <= STEP_COUNT; step++) {
			await next.click();
			await expect(page.locator(sel(TOUR_PROGRESS_TID))).toHaveText(`${step} / ${STEP_COUNT}`);
		}

		// The tour seeded "Your first event" on today and the indexer rendered it.
		await expect(page.locator(SAMPLE_TILE)).toHaveCount(1);

		await expect(next).toHaveText("Done");
		await next.click();
		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toHaveCount(0);

		await settleSettings(page, { pluginId: PLUGIN_ID });
		expect(readTutorialCompleted(vaultDir)).toBe(true);
	});
});
