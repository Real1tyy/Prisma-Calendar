import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BasesSettingsReact } from "../../../src/react/settings/bases-settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function setup(initial = {}) {
	const store = createMockCalendarSettingsStore(initial);
	const user = userEvent.setup();
	const result = render(<BasesSettingsReact settingsStore={store} />);
	return { store, user, ...result };
}

describe("BasesSettingsReact", () => {
	it("renders the 'Bases' section heading and both schema fields", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toContain("Bases");

		expect(screen.getByTestId("prisma-settings-field-basesViewType")).toBeTruthy();
		expect(screen.getByTestId("prisma-settings-field-basesViewProperties")).toBeTruthy();
	});

	it("uses the overridden labels 'View type' and 'Additional properties'", () => {
		const { container } = setup();
		const names = Array.from(container.querySelectorAll<HTMLElement>(".setting-item-name")).map((el) => el.textContent);
		expect(names).toContain("View type");
		expect(names).toContain("Additional properties");
	});

	it("renders the view-type dropdown with override option labels", () => {
		setup();
		const row = screen.getByTestId("prisma-settings-field-basesViewType");
		const select = row.querySelector<HTMLSelectElement>("select.dropdown")!;
		const labels = Array.from(select.options).map((o) => o.textContent);
		expect(labels).toEqual(expect.arrayContaining(["Cards (Recommended)", "Table", "List"]));
	});

	it("changing the view-type dropdown commits to the store", async () => {
		const { store, user } = setup({ basesViewType: "cards" });
		const row = screen.getByTestId("prisma-settings-field-basesViewType");
		const select = row.querySelector<HTMLSelectElement>("select.dropdown")!;
		await user.selectOptions(select, "table");
		expect(store.currentSettings.basesViewType).toBe("table");
	});

	it("typing into the additional-properties input commits a parsed list to the store", async () => {
		const { store, user } = setup({ basesViewProperties: [] });
		const row = screen.getByTestId("prisma-settings-field-basesViewProperties");
		const input = row.querySelector<HTMLInputElement>("input.setting-input")!;
		await user.type(input, "priority, tags");
		input.blur();
		expect(store.currentSettings.basesViewProperties).toEqual(["priority", "tags"]);
	});
});
