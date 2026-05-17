import { expect, test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { FORM_SUBMIT_TID, sel, TID } from "../../fixtures/testids";
import { openCreateModal, waitForModalClosed } from "./events-helpers";
import { fillEventModal } from "./fill-event-modal";

// Parity guard for the Save-as-preset footer button on the React event form.
// The imperative modal wrote presets via `extractPresetFromState` + a manual
// settings update; the React port routes through `openSavePresetFlow` in
// shared-modal-helpers.ts. These specs assert the full round-trip: capture
// current form state into a preset, re-open the form, and prove the preset
// dropdown rehydrates the same fields.

const SAVE_PRESET_NAME_TID = "prisma-save-preset-control-presetName";
const SAVE_PRESET_MODAL_TID = "prisma-modal-save-preset";

test.describe("event modal — Save as preset", () => {
	test("captures current form state as a new preset visible in the dropdown", async ({ calendar }) => {
		// Start with no presets — the Save-as-preset button must still render
		// because the form passes `onSavePreset` unconditionally on create.
		await updateCalendarSettings(calendar.page, { eventPresets: [] });

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Weekly Review",
			location: "Office",
			icon: "calendar",
			breakMinutes: 5,
		});

		// Open the save-as-preset modal.
		await calendar.page
			.locator(sel(TID.event.btn("save-preset")))
			.first()
			.click();
		const presetModal = calendar.page.locator(sel(SAVE_PRESET_MODAL_TID));
		await presetModal.waitFor({ state: "visible" });

		// Name the preset and submit. Save-to dropdown defaults to "Create new
		// preset" (empty value) when not at the free-tier limit.
		await presetModal.locator(sel(SAVE_PRESET_NAME_TID)).fill("My Review Preset");
		await presetModal.locator(sel(FORM_SUBMIT_TID)).click();
		await presetModal.waitFor({ state: "detached" });

		// Cancel the event modal — the spec is about preset capture, not save.
		await calendar.page
			.locator(sel(TID.event.btn("cancel")))
			.first()
			.click();
		await waitForModalClosed(calendar.page);

		// Re-open: the new preset is in the dropdown, and applying it refills
		// the saved fields.
		await openCreateModal(calendar.page);
		const presetSelect = calendar.page.locator(sel(TID.event.control("preset"))).first();
		const options = await presetSelect.locator("option").allTextContents();
		expect(options).toContain("My Review Preset");

		// The new preset id is generated as `preset-<timestamp>`. Selecting by
		// label is more robust than guessing the id.
		await presetSelect.selectOption({ label: "My Review Preset" });

		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Weekly Review");
		await expect(calendar.page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Office");
		await expect(calendar.page.locator(sel(TID.event.control("icon"))).first()).toHaveValue("calendar");
		await expect(calendar.page.locator(sel(TID.event.control("breakMinutes"))).first()).toHaveValue("5");
	});

	test("overriding an existing preset updates it in place", async ({ calendar }) => {
		await updateCalendarSettings(calendar.page, {
			eventPresets: [{ id: "preset-old", name: "Stand-up", title: "Old Title", createdAt: 1_700_000_000_000 }],
		});

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, { title: "Renamed Stand-up", location: "Room B" });

		await calendar.page
			.locator(sel(TID.event.btn("save-preset")))
			.first()
			.click();
		const presetModal = calendar.page.locator(sel(SAVE_PRESET_MODAL_TID));
		await presetModal.waitFor({ state: "visible" });

		// Pick the existing preset as the override target.
		await presetModal.locator(sel("prisma-save-preset-control-saveTo")).selectOption("preset-old");
		await presetModal.locator(sel(SAVE_PRESET_NAME_TID)).fill("Stand-up");
		await presetModal.locator(sel(FORM_SUBMIT_TID)).click();
		await presetModal.waitFor({ state: "detached" });

		// Cancel out of the event modal.
		await calendar.page
			.locator(sel(TID.event.btn("cancel")))
			.first()
			.click();
		await waitForModalClosed(calendar.page);

		// Re-open and apply the (overridden) preset by its stable id — the
		// title and location must reflect the override.
		await openCreateModal(calendar.page);
		await calendar.page
			.locator(sel(TID.event.control("preset")))
			.first()
			.selectOption("preset-old");
		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Renamed Stand-up");
		await expect(calendar.page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Room B");
	});
});
