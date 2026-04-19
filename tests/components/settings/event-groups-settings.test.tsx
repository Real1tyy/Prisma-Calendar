import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EventGroupsSettingsReact } from "../../../src/react/settings/event-groups-settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function setup(initial = {}) {
	const store = createMockCalendarSettingsStore(initial);
	const user = userEvent.setup();
	const result = render(<EventGroupsSettingsReact settingsStore={store} />);
	return { store, user, ...result };
}

function toggleByName(container: HTMLElement, name: string): HTMLElement {
	const items = Array.from(container.querySelectorAll<HTMLElement>(".setting-item"));
	const match = items.find((el) => el.querySelector(".setting-item-name")?.textContent === name);
	if (!match) throw new Error(`No setting row with name "${name}"`);
	const toggle = match.querySelector<HTMLElement>(".checkbox-container");
	if (!toggle) throw new Error(`No toggle in row "${name}"`);
	return toggle;
}

describe("EventGroupsSettingsReact", () => {
	it("renders section headings", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toEqual(
			expect.arrayContaining([
				"Recurring events",
				"Name series propagation",
				"Category series propagation",
				"Event markers",
			])
		);
	});

	it("enabling propagate-to-instances flips ask-before off", async () => {
		const { store, user, container } = setup({
			propagateFrontmatterToInstances: false,
			askBeforePropagatingFrontmatter: true,
		});
		await user.click(toggleByName(container, "Propagate frontmatter to instances"));
		expect(store.currentSettings.propagateFrontmatterToInstances).toBe(true);
		expect(store.currentSettings.askBeforePropagatingFrontmatter).toBe(false);
	});

	it("enabling ask-before-propagating flips propagate off", async () => {
		const { store, user, container } = setup({
			propagateFrontmatterToInstances: true,
			askBeforePropagatingFrontmatter: false,
		});
		await user.click(toggleByName(container, "Ask before propagating"));
		expect(store.currentSettings.propagateFrontmatterToInstances).toBe(false);
		expect(store.currentSettings.askBeforePropagatingFrontmatter).toBe(true);
	});

	it("uses the overridden 'Excluded properties' label on excluded prop inputs", () => {
		const { container } = setup();
		const names = Array.from(container.querySelectorAll<HTMLElement>(".setting-item-name")).map((el) => el.textContent);
		const excludedCount = names.filter((t) => t === "Excluded properties").length;
		expect(excludedCount).toBe(3);
	});
});
