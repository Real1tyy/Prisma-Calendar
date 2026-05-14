import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PerformanceSettingsReact } from "../../../src/react/settings/performance-settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function setup(initial = {}) {
	const store = createMockCalendarSettingsStore(initial);
	const user = userEvent.setup();
	const result = render(<PerformanceSettingsReact settingsStore={store} />);
	return { store, user, ...result };
}

describe("PerformanceSettingsReact", () => {
	it("renders the 'Performance' heading and both schema fields", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toContain("Performance");

		expect(screen.getByTestId("prisma-settings-field-enableNameSeriesTracking")).toBeTruthy();
		expect(screen.getByTestId("prisma-settings-field-fileConcurrencyLimit")).toBeTruthy();
	});

	it("toggling enableNameSeriesTracking commits the new value", async () => {
		const { store, user } = setup({ enableNameSeriesTracking: false });
		const row = screen.getByTestId("prisma-settings-field-enableNameSeriesTracking");
		const toggle = row.querySelector<HTMLElement>(".checkbox-container")!;
		await user.click(toggle);
		expect(store.currentSettings.enableNameSeriesTracking).toBe(true);
	});

	it("renders fileConcurrencyLimit as a range slider with min/max bounds", () => {
		setup({ fileConcurrencyLimit: 4 });
		const row = screen.getByTestId("prisma-settings-field-fileConcurrencyLimit");
		const slider = row.querySelector<HTMLInputElement>("input[type='range']")!;
		expect(slider.min).toBe("1");
		expect(slider.max).toBe("50");
		expect(slider.value).toBe("4");
	});
});
