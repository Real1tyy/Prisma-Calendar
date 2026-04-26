import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CalendarSettingsReact } from "../../../src/react/settings/calendar-settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function setup(initial = {}) {
	const store = createMockCalendarSettingsStore(initial);
	const user = userEvent.setup();
	const result = render(<CalendarSettingsReact settingsStore={store} />);
	return { store, user, ...result };
}

function selectByLabel(container: HTMLElement, name: string): HTMLSelectElement {
	const items = Array.from(container.querySelectorAll<HTMLElement>(".setting-item"));
	const match = items.find((el) => el.querySelector(".setting-item-name")?.textContent === name);
	if (!match) throw new Error(`No setting row with name "${name}"`);
	const select = match.querySelector<HTMLSelectElement>("select.dropdown");
	if (!select) throw new Error(`No select in row "${name}"`);
	return select;
}

describe("CalendarSettingsReact", () => {
	it("renders top-level section headings", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toEqual(expect.arrayContaining(["Views", "Event appearance", "Time grid", "Event overlap"]));
	});

	it("renders view dropdowns with human-readable option labels", () => {
		const { container } = setup();
		const defaultView = selectByLabel(container, "Default view");
		const labels = Array.from(defaultView.options).map((o) => o.textContent);
		expect(labels).toEqual(expect.arrayContaining(["Month", "Week (Time)", "Day (Time)", "Week (List)"]));
	});

	it("firstDayOfWeek dropdown commits parsed integer to the store", async () => {
		const { store, user, container } = setup({ firstDayOfWeek: 0 });
		const select = selectByLabel(container, "First day of week");
		await user.selectOptions(select, "1");
		expect(store.currentSettings.firstDayOfWeek).toBe(1);
	});

	it("dayCellColoring off shows no month color pickers", () => {
		const { container } = setup({ dayCellColoring: "off" });
		const names = Array.from(container.querySelectorAll<HTMLElement>(".setting-item-name")).map((el) => el.textContent);
		expect(names).not.toContain("Day background color");
		expect(names).not.toContain("Even month color");
		expect(names).not.toContain("Odd month color");
	});

	it("dayCellColoring uniform reveals the single background color picker", () => {
		const { container } = setup({ dayCellColoring: "uniform" });
		const names = Array.from(container.querySelectorAll<HTMLElement>(".setting-item-name")).map((el) => el.textContent);
		expect(names).toContain("Day background color");
	});

	it("dayCellColoring boundary reveals even+odd month color pickers", () => {
		const { container } = setup({ dayCellColoring: "boundary" });
		const names = Array.from(container.querySelectorAll<HTMLElement>(".setting-item-name")).map((el) => el.textContent);
		expect(names).toContain("Even month color");
		expect(names).toContain("Odd month color");
	});
});
