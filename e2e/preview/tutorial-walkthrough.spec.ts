import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, testOnboarding } from "../fixtures/electron";
import { sel, TOUR_NEXT_TID, TOUR_PROGRESS_TID, TOUR_TOOLTIP_TID } from "../fixtures/testids";
import { dragSampleEventToNewTime, TOUR_STEP_COUNT, TOUR_STEP_IDS } from "../fixtures/tour";

// On-demand walkthrough for humans + agents — NOT part of the real suite. It only
// runs under `PRISMA_PREVIEW=1` (see playwright.config.ts, which adds the "preview"
// project) via `pnpm run preview:tutorial`. It drives the tour exactly as a user
// would and writes one numbered screenshot per step; the run's collect-artifacts.mjs
// step then stitches those frames into a video + gif so you can review the whole
// flow without launching Obsidian by hand. (Playwright can't record real video here
// — the Obsidian harness connects over CDP rather than launching a browser context.)
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
				// "Nb-" sorts right after "0N-" so the before/after drag frames stay in order.
				await shot(`${String(step).padStart(2, "0")}b-${id}-after`);
				testInfo.annotations.push({ type: "preview", description: `dragged sample event → ${expectedStart}` });
			}

			if (step < TOUR_STEP_COUNT) await next.click();
		}

		await expect(next).toHaveText("Done");
		await next.click();
		await expect(page.locator(sel(TOUR_TOOLTIP_TID))).toHaveCount(0);

		testInfo.annotations.push({ type: "preview", description: `frames written to ${PREVIEW_DIR}/` });
	});
});
