import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomPropertiesSection } from "../../../src/react/event-form/sections/custom-properties-section";

function getRows(section: "display" | "other" = "display"): HTMLElement[] {
	const container = screen.getByTestId(`prisma-event-custom-props-${section}-container`);
	return Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="prisma-event-custom-prop-row-${section}"]`));
}

async function expandSection(user: ReturnType<typeof userEvent.setup>, section: "display" | "other" = "display") {
	const wrapper = screen.getByTestId(`prisma-event-custom-props-${section}`);
	const trigger = wrapper.querySelector<HTMLElement>(".prisma-collapsible-section-header");
	if (trigger) await user.click(trigger);
}

describe("CustomPropertiesSection", () => {
	it("renders existing initialProperties as populated rows", async () => {
		const user = userEvent.setup();
		render(
			<CustomPropertiesSection
				section="display"
				title="Display Properties"
				initialProperties={[
					{ key: "project", value: "Alpha" },
					{ key: "priority", value: "High" },
				]}
				onPropertiesChange={vi.fn()}
			/>
		);

		await expandSection(user);
		const rows = getRows();
		expect(rows.length).toBe(2);
		const firstKey = within(rows[0]).getByTestId("prisma-event-custom-prop-key-display") as HTMLInputElement;
		const firstVal = within(rows[0]).getByTestId("prisma-event-custom-prop-value-display") as HTMLInputElement;
		expect(firstKey.value).toBe("project");
		expect(firstVal.value).toBe("Alpha");
	});

	it("appends a blank row when add button is clicked", async () => {
		const user = userEvent.setup();
		render(
			<CustomPropertiesSection
				section="display"
				title="Display Properties"
				initialProperties={[]}
				onPropertiesChange={vi.fn()}
			/>
		);
		await expandSection(user);
		expect(getRows().length).toBe(0);

		await user.click(screen.getByTestId("prisma-event-btn-add-custom-prop-display"));
		expect(getRows().length).toBe(1);
	});

	it("emits onPropertiesChange when a key/value is edited", async () => {
		const user = userEvent.setup();
		const onPropertiesChange = vi.fn();
		render(
			<CustomPropertiesSection
				section="display"
				title="Display Properties"
				initialProperties={[{ key: "project", value: "Alpha" }]}
				onPropertiesChange={onPropertiesChange}
			/>
		);
		await expandSection(user);

		const valInput = screen.getByTestId("prisma-event-custom-prop-value-display") as HTMLInputElement;
		await user.clear(valInput);
		await user.type(valInput, "Beta");

		const last = onPropertiesChange.mock.calls.at(-1)?.[0] as Record<string, string>;
		expect(last).toEqual({ project: "Beta" });
	});

	it("filters rows with empty keys out of the emitted record", async () => {
		const user = userEvent.setup();
		const onPropertiesChange = vi.fn();
		render(
			<CustomPropertiesSection
				section="other"
				title="Other Properties"
				initialProperties={[]}
				onPropertiesChange={onPropertiesChange}
			/>
		);
		await expandSection(user, "other");
		await user.click(screen.getByTestId("prisma-event-btn-add-custom-prop-other"));

		const valInput = screen.getByTestId("prisma-event-custom-prop-value-other") as HTMLInputElement;
		await user.type(valInput, "lonely-value");

		const last = onPropertiesChange.mock.calls.at(-1)?.[0] as Record<string, string>;
		expect(last).toEqual({});
	});

	it("removes a row and updates the record", async () => {
		const user = userEvent.setup();
		const onPropertiesChange = vi.fn();
		render(
			<CustomPropertiesSection
				section="display"
				title="Display Properties"
				initialProperties={[
					{ key: "project", value: "Alpha" },
					{ key: "priority", value: "High" },
				]}
				onPropertiesChange={onPropertiesChange}
			/>
		);
		await expandSection(user);

		const removeBtns = screen.getAllByTestId("prisma-event-btn-remove-custom-prop-display");
		await user.click(removeBtns[0]);

		expect(getRows().length).toBe(1);
		const last = onPropertiesChange.mock.calls.at(-1)?.[0] as Record<string, string>;
		expect(last).toEqual({ priority: "High" });
	});
});
