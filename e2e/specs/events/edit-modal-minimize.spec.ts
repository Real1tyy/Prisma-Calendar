import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createEventHandle } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import { EVENT_MODAL_SELECTOR, formatLocalDate } from "./events-helpers";

// Parity guard for the minimize-to-dock flow on the EDIT modal. The create-
// side roundtrip is covered by modal-ux.spec.ts; this spec mirrors it for
// the edit path. The React port wires the edit-side via
// `saveMinimizedModalState(values, "edit", filePath, originalFrontmatter, ...)`
// in event-edit-modal.tsx, then `MinimizedModalManager.openRestoredModal`
// reopens the imperative EventEditModal with that state. A regression in this
// hand-off would drop the title (which is the only field the create-side spec
// asserts).

test.describe("event modal — edit-side minimize/restore", () => {
	test("minimize then restore on an edit modal preserves pending title edit", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const seedPath = "Events/Editable Mini-20250101000000.md";
		writeFileSync(
			join(calendar.vaultDir, seedPath),
			`---
Start Date: ${today}T09:00
End Date: ${today}T10:00
Already Notified: true
---

# Editable Mini
`,
			"utf8"
		);

		const evt = createEventHandle(calendar, seedPath, "Editable Mini");
		await evt.expectVisible();
		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		const titleInput = calendar.page.locator(sel(TID.event.control("title"))).first();
		await expect(titleInput).toHaveValue("Editable Mini");
		await titleInput.fill("Renamed Pending");

		await calendar.page
			.locator(sel(TID.event.btn("minimize")))
			.first()
			.click();
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "detached" });

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Renamed Pending");
	});

	// KNOWN REGRESSION: minimize→restore on an edit modal does NOT carry
	// metadata fields (location/icon/break) through. `MinimizedModalManager
	// .openRestoredModal` constructs an imperative `EventEditModal` and calls
	// `setRestoreState(state)`, but the imperative modal's initialize() loads
	// the simple-field values back from the original frontmatter, overwriting
	// the pending edit. Surfacing here so the fix lands before the imperative
	// modal is fully removed (it's still the restore-side renderer).
	test.fail("minimize then restore preserves a pending location edit", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const seedPath = "Events/Editable LocMini-20250101000000.md";
		writeFileSync(
			join(calendar.vaultDir, seedPath),
			`---
Start Date: ${today}T09:00
End Date: ${today}T10:00
Location: Original Room
Already Notified: true
---

# Editable LocMini
`,
			"utf8"
		);

		const evt = createEventHandle(calendar, seedPath, "Editable LocMini");
		await evt.expectVisible();
		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await calendar.page
			.locator(sel(TID.event.control("location")))
			.first()
			.fill("Pending Edit Room");
		await calendar.page
			.locator(sel(TID.event.btn("minimize")))
			.first()
			.click();
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "detached" });

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await expect(calendar.page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Pending Edit Room");
	});
});
