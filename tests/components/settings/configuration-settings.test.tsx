import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BATCH_BUTTON_IDS, TOOLBAR_BUTTON_IDS } from "../../../src/constants";
import { ConfigurationSettingsReact } from "../../../src/react/settings/configuration-settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function setup(initial = {}) {
	const store = createMockCalendarSettingsStore(initial);
	const user = userEvent.setup();
	const result = render(<ConfigurationSettingsReact settingsStore={store} />);
	return { store, user, ...result };
}

describe("ConfigurationSettingsReact — section structure", () => {
	it("renders the three top-level section headings", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toEqual(
			expect.arrayContaining(["Desktop toolbar buttons", "Mobile toolbar buttons", "Batch selection"])
		);
	});

	it("renders one row per TOOLBAR_BUTTON_IDS entry in each toolbar section", () => {
		setup();
		for (const id of TOOLBAR_BUTTON_IDS) {
			expect(screen.getByTestId(`prisma-settings-field-toolbarButtons-${id}`)).toBeTruthy();
			expect(screen.getByTestId(`prisma-settings-field-mobileToolbarButtons-${id}`)).toBeTruthy();
		}
	});

	it("renders one row per BATCH_BUTTON_IDS entry under Batch selection", () => {
		setup();
		for (const id of BATCH_BUTTON_IDS) {
			expect(screen.getByTestId(`prisma-settings-field-batch-action-buttons-${id}`)).toBeTruthy();
		}
	});
});

describe("ConfigurationSettingsReact — toolbar toggle behaviour", () => {
	it("starting checked, clicking removes the button id from settings.toolbarButtons", async () => {
		const { store, user } = setup({ toolbarButtons: ["today", "createEvent", "now"] });

		const row = screen.getByTestId("prisma-settings-field-toolbarButtons-today");
		const toggle = row.querySelector<HTMLElement>(".checkbox-container")!;
		await user.click(toggle);

		expect(store.currentSettings.toolbarButtons).toEqual(["createEvent", "now"]);
	});

	it("starting unchecked, clicking appends the button id", async () => {
		const { store, user } = setup({ toolbarButtons: ["today"] });

		const row = screen.getByTestId("prisma-settings-field-toolbarButtons-now");
		const toggle = row.querySelector<HTMLElement>(".checkbox-container")!;
		await user.click(toggle);

		expect(store.currentSettings.toolbarButtons).toContain("now");
	});

	it("Mobile toolbar toggles operate on mobileToolbarButtons independently", async () => {
		const { store, user } = setup({
			toolbarButtons: ["today", "now"],
			mobileToolbarButtons: ["today"],
		});

		const row = screen.getByTestId("prisma-settings-field-mobileToolbarButtons-now");
		const toggle = row.querySelector<HTMLElement>(".checkbox-container")!;
		await user.click(toggle);

		expect(store.currentSettings.mobileToolbarButtons).toContain("now");
		expect(store.currentSettings.toolbarButtons).toEqual(["today", "now"]);
	});
});

describe("ConfigurationSettingsReact — batch toggle behaviour", () => {
	it("toggling on appends to batchActionButtons preserving canonical BATCH_BUTTON_IDS order", async () => {
		const { store, user } = setup({ batchActionButtons: ["batchSelectAll"] });

		const row = screen.getByTestId("prisma-settings-field-batch-action-buttons-batchClear");
		const toggle = row.querySelector<HTMLElement>(".checkbox-container")!;
		await user.click(toggle);

		const result = store.currentSettings.batchActionButtons as string[];
		expect(result).toContain("batchSelectAll");
		expect(result).toContain("batchClear");
		expect(result.indexOf("batchSelectAll")).toBeLessThan(result.indexOf("batchClear"));
	});

	it("toggling off removes the button id from batchActionButtons", async () => {
		const { store, user } = setup({ batchActionButtons: ["batchSelectAll", "batchClear"] });

		const row = screen.getByTestId("prisma-settings-field-batch-action-buttons-batchClear");
		const toggle = row.querySelector<HTMLElement>(".checkbox-container")!;
		await user.click(toggle);

		expect(store.currentSettings.batchActionButtons).toEqual(["batchSelectAll"]);
	});
});
