import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, testOnboarding } from "../fixtures/electron";
import { sel, TOUR_NEXT_TID, TOUR_PROGRESS_TID, TOUR_TOOLTIP_TID } from "../fixtures/testids";
import { dragSampleEventToNewTime, TOUR_STEP_COUNT, TOUR_STEP_IDS } from "../fixtures/tour";

// On-demand walkthrough for humans + agents — NOT part of the real suite. It only
// runs under `PRISMA_PREVIEW=1` (see playwright.config.ts, which adds the "preview"
// project and flips video/screenshot on) via `pnpm run preview:tutorial`. It drives
// the tour exactly as a user would and writes a numbered screenshot per step plus a
// video, so you can review the whole flow without launching Obsidian by hand.
const PREVIEW_DIR = "e2e/.preview/tutorial";
const DRAG_STEP = TOUR_STEP_IDS.indexOf("drag-and-drop") + 1;

testOnboarding.describe("preview: onboarding tutorial walkthrough", () => {
	testOnboarding("captures every step and exercises the interactive drag", async ({ calendar }, testInfo) => {
		const { page, vaultDir } = calendar;
		mkdirSync(PREVIEW_DIR, { recursive: true });

		const shot = (name: string): Promise<Buffer> => page.screenshot({ path: join(PREVIEW_DIR, `${name}.png`) });

		// The tour auto-starts (testOnboarding seeds tutorialCompleted: false).
		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toBeVisible();

		const next = page.locator(sel(TOUR_NEXT_TID));
		for (let step = 1; step <= TOUR_STEP_COUNT; step++) {
			await expect(page.locator(sel(TOUR_PROGRESS_TID))).toHaveText(`${step} / ${TOUR_STEP_COUNT}`);
			const id = TOUR_STEP_IDS[step - 1];
			await shot(`${String(step).padStart(2, "0")}-${id}`);

			if (step === DRAG_STEP) {
				const { expectedStart } = await dragSampleEventToNewTime(page, vaultDir);
				await shot(`${String(step).padStart(2, "0")}-${id}-after-drag`);
				testInfo.annotations.push({ type: "preview", description: `dragged sample event → ${expectedStart}` });
			}

			if (step < TOUR_STEP_COUNT) await next.click();
		}

		await expect(next).toHaveText("Done");
		await next.click();
		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toHaveCount(0);

		testInfo.annotations.push({
			type: "preview",
			description: `screenshots in ${PREVIEW_DIR}/ — video in the HTML report`,
		});
	});
});
