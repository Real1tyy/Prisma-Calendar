import { readEventFrontmatter, readPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { expect, testOnboarding } from "../../fixtures/electron";
import { sel, TOUR_PROGRESS_TID, TOUR_SKIP_TID, TOUR_TOOLTIP_TID } from "../../fixtures/testids";
import {
	advanceTourTo,
	dragSampleEventToNewTime,
	SAMPLE_EVENT_TILE,
	TOUR_STEP_COUNT,
	TOUR_STEP_IDS,
} from "../../fixtures/tour";

// Only the boundaries RTL/unit can't fake live at E2E: the plugin-boot auto-trigger,
// a real FullCalendar drag through the (overlay-free) spotlight writing on-disk
// frontmatter, and tutorialCompleted persisting to data.json. Everything else is
// covered more cheaply elsewhere:
//   • settings-button → close + launch (and, symmetrically, the command that just
//     calls startPrismaTour): tests/components/settings/general-settings-help.test.tsx (RTL)
//   • step list + per-step interaction: tests/components/onboarding/prisma-tour.test.tsx (unit)
//   • engine step→overlay mapping: shared-react/tests/onboarding/tour-host.test.ts (unit)
const DRAG_STEP = TOUR_STEP_IDS.indexOf("drag-and-drop") + 1;

function readTutorialCompleted(vaultDir: string): boolean | undefined {
	return (readPluginData(vaultDir, PLUGIN_ID) as { tutorialCompleted?: boolean }).tutorialCompleted;
}

testOnboarding(
	"auto-starts on launch, the highlighted event drags to a new time on disk, and finishing records completion",
	async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		// Auto-starts on boot (no command) because the seed left tutorialCompleted false.
		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toBeVisible();
		await expect(page.locator(sel(TOUR_PROGRESS_TID))).toHaveText(`1 / ${TOUR_STEP_COUNT}`);

		// Reaching the drag step seeds "Your first event" on today.
		await advanceTourTo(page, DRAG_STEP);
		await expect(page.locator(SAMPLE_EVENT_TILE)).toHaveCount(1);

		// The drag reaches the grid through the overlay-free spotlight and FullCalendar
		// writes the new time straight back to the note.
		const { filePath, expectedStart } = await dragSampleEventToNewTime(page, vaultDir);
		await expect.poll(() => String(readEventFrontmatter(vaultDir, filePath)["Start Date"])).toContain(expectedStart);

		// Ending the tour persists completion so it won't auto-start again.
		await page.locator(sel(TOUR_SKIP_TID)).click();
		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toHaveCount(0);
		await settleSettings(page, { pluginId: PLUGIN_ID });
		expect(readTutorialCompleted(vaultDir)).toBe(true);
	}
);
