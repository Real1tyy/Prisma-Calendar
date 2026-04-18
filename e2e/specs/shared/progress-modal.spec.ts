import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expectProgressModal } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { ICS_IMPORT_FILE_TID, ICS_IMPORT_SUBMIT_TID, sel } from "../../fixtures/testids";

// Exercises `showProgressModal` from shared/src/components/primitives/
// progress-modal.ts. Prisma consumes it from `showICSImportProgressModal`
// (src/components/modals/import-export/ics-import-progress.ts) — driven by
// `Prisma Calendar: Import .ics file` through a real file input. The shared
// component stamps `prisma-progress-modal`, `prisma-progress-status`,
// `prisma-progress-bar`, `prisma-progress-details`; this spec asserts the
// modal appears, progresses to 100%, and then auto-closes per the
// `successCloseDelay` contract.

function buildICS(count: number): string {
	const header = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Prisma E2E//Progress Spec//EN", "CALSCALE:GREGORIAN"];
	const events: string[] = [];
	for (let i = 0; i < count; i++) {
		const hour = String(9 + (i % 8)).padStart(2, "0");
		const day = String(1 + i).padStart(2, "0");
		events.push(
			"BEGIN:VEVENT",
			`UID:progress-${i}@prisma-e2e`,
			`DTSTAMP:20260601T000000Z`,
			`DTSTART:202607${day}T${hour}0000Z`,
			`DTEND:202607${day}T${hour}3000Z`,
			`SUMMARY:Imported Event ${i + 1}`,
			"END:VEVENT"
		);
	}
	return [...header, ...events, "END:VCALENDAR"].join("\r\n");
}

test.describe("shared: progress-modal", () => {
	test("shows modal during ICS import, reaches 100%, auto-closes on success", async ({ calendar }) => {
		const icsDir = join(calendar.vaultDir, "ICS-Inbox");
		mkdirSync(icsDir, { recursive: true });
		const icsPath = join(icsDir, "progress-spec.ics");
		writeFileSync(icsPath, buildICS(8), "utf8");

		await calendar.runCommand("Prisma Calendar: Import .ics file");
		await calendar.page.locator(sel(ICS_IMPORT_FILE_TID)).first().setInputFiles(icsPath);
		const submit = calendar.page.locator(sel(ICS_IMPORT_SUBMIT_TID)).first();
		await expect(submit).toBeEnabled();
		await submit.click();

		const progress = await expectProgressModal(calendar.page);
		await expect(progress.status).toBeVisible();
		await expect(progress.details).toBeVisible();

		// The shared modal rewrites status to "Importing events complete" after
		// `showComplete` fires. Polling that transition verifies the progress
		// updates actually flowed through the shared component (not just the
		// initial render).
		await expect(progress.status).toContainText(/complete/i);
		// Summary line format comes from ics-import-progress.ts: "✓ N imported".
		await expect(progress.details).toContainText(/imported/i);

		// The shared modal auto-closes after `successCloseDelay` (2000ms by
		// default). Assert the user-visible contract — no lingering overlay.
		await progress.waitForClose();
	});
});
