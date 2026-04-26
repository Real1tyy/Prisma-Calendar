import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RulesSettingsReact } from "../../../src/react/settings/rules-settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function setup(initial = {}) {
	const store = createMockCalendarSettingsStore(initial);
	const user = userEvent.setup();
	const result = render(<RulesSettingsReact settingsStore={store} />);
	return { store, user, ...result };
}

describe("RulesSettingsReact", () => {
	it("renders all section headings", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);

		expect(headings).toEqual(
			expect.arrayContaining(["Event colors", "Event filtering", "Untracked event filtering", "Filter presets"])
		);
	});

	it("renders color mode dropdown", () => {
		const { container } = setup({ colorMode: "1" });
		const settingRows = Array.from(container.querySelectorAll<HTMLElement>(".setting-item"));
		const colorModeRow = settingRows.find((el) => el.querySelector(".setting-item-name")?.textContent === "Color Mode");
		expect(colorModeRow).toBeTruthy();
		const select = colorModeRow!.querySelector<HTMLSelectElement>("select");
		expect(select).toBeTruthy();
		expect(select!.value).toBe("1");
	});

	it("shows empty state when no color rules", () => {
		const { container } = setup({ colorRules: [] });
		expect(container.textContent).toContain("No color rules defined");
	});

	it("renders existing color rules", () => {
		const { container } = setup({
			colorRules: [
				{ id: "r1", expression: "Priority === 'High'", color: "#ff0000", enabled: true },
				{ id: "r2", expression: "Status === 'Done'", color: "#00ff00", enabled: false },
			],
		});
		const ruleItems = container.querySelectorAll(".prisma-color-rule-item");
		expect(ruleItems.length).toBe(2);
	});

	it("adds a new color rule via the Add rule button", async () => {
		const { store, user, container } = setup({ colorRules: [] });
		const addButton = container.querySelector<HTMLButtonElement>("[data-testid='prisma-rules-add-color-rule']");
		expect(addButton).toBeTruthy();
		await user.click(addButton!);
		expect(store.currentSettings.colorRules.length).toBe(1);
	});

	it("deletes a color rule", async () => {
		const { store, user, container } = setup({
			colorRules: [{ id: "r1", expression: "test", color: "#000", enabled: true }],
		});
		const deleteBtn = container.querySelector<HTMLButtonElement>(".prisma-color-rule-btn-delete");
		expect(deleteBtn).toBeTruthy();
		await user.click(deleteBtn!);
		expect(store.currentSettings.colorRules.length).toBe(0);
	});

	it("shows empty state when no filter presets", () => {
		const { container } = setup({ filterPresets: [] });
		expect(container.textContent).toContain("No filter presets defined");
	});
});
