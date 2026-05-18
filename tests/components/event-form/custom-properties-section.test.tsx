import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useForm, useWatch } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import {
	CustomPropertiesSection,
	customPropertiesToRecord,
} from "../../../src/react/event-form/sections/custom-properties-section";

function Harness({
	section,
	name,
	initial = [],
	onChange,
}: {
	section: "display" | "other";
	name: "customPropertiesDisplay" | "customPropertiesOther";
	initial?: Array<{ key: string; value: string }>;
	onChange?: (record: Record<string, string>) => void;
}) {
	const form = useForm<EventFormState>({
		defaultValues: { ...createDefaultState(), [name]: initial },
	});
	const entries = useWatch({ control: form.control, name });
	if (onChange) onChange(customPropertiesToRecord(entries));
	return <CustomPropertiesSection section={section} title="Custom" form={form} name={name} />;
}

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
	it("renders existing initial entries as populated rows", async () => {
		const user = userEvent.setup();
		render(
			<Harness
				section="display"
				name="customPropertiesDisplay"
				initial={[
					{ key: "project", value: "Alpha" },
					{ key: "priority", value: "High" },
				]}
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
		render(<Harness section="display" name="customPropertiesDisplay" />);
		await expandSection(user);
		expect(getRows().length).toBe(0);

		await user.click(screen.getByTestId("prisma-event-btn-add-custom-prop-display"));
		expect(getRows().length).toBe(1);
	});

	it("reflects edits in the form-derived record", async () => {
		const user = userEvent.setup();
		let lastRecord: Record<string, string> = {};
		render(
			<Harness
				section="display"
				name="customPropertiesDisplay"
				initial={[{ key: "project", value: "Alpha" }]}
				onChange={(r) => {
					lastRecord = r;
				}}
			/>
		);
		await expandSection(user);

		const valInput = screen.getByTestId("prisma-event-custom-prop-value-display") as HTMLInputElement;
		await user.clear(valInput);
		await user.type(valInput, "Beta");

		expect(lastRecord).toEqual({ project: "Beta" });
	});

	it("filters rows with empty keys out of the emitted record", async () => {
		const user = userEvent.setup();
		let lastRecord: Record<string, string> = {};
		render(
			<Harness
				section="other"
				name="customPropertiesOther"
				onChange={(r) => {
					lastRecord = r;
				}}
			/>
		);
		await expandSection(user, "other");
		await user.click(screen.getByTestId("prisma-event-btn-add-custom-prop-other"));

		const valInput = screen.getByTestId("prisma-event-custom-prop-value-other") as HTMLInputElement;
		await user.type(valInput, "lonely-value");

		expect(lastRecord).toEqual({});
	});

	// Regression: imperative base-event-modal `addCustomProperty` flow auto-expanded
	// the section and never collapsed it. Pressing "Add property" while collapsed
	// must expand the section so the new row is visible; pressing it while
	// expanded must NOT collapse it (the action button's click was bubbling to
	// the collapsible header, snapping the section closed).
	it("auto-expands the section when Add property is clicked while collapsed", async () => {
		const user = userEvent.setup();
		render(<Harness section="display" name="customPropertiesDisplay" />);

		// Section starts collapsed (defaultCollapsed=true).
		const wrapper = screen.getByTestId("prisma-event-custom-props-display");
		const header = wrapper.querySelector<HTMLElement>('[role="button"]');
		expect(header).not.toBeNull();
		expect(header).toHaveAttribute("aria-expanded", "false");

		await user.click(screen.getByTestId("prisma-event-btn-add-custom-prop-display"));

		expect(header).toHaveAttribute("aria-expanded", "true");
		expect(getRows().length).toBe(1);
	});

	it("does NOT collapse the section when Add property is clicked while expanded", async () => {
		const user = userEvent.setup();
		render(<Harness section="display" name="customPropertiesDisplay" />);

		const wrapper = screen.getByTestId("prisma-event-custom-props-display");
		const header = wrapper.querySelector<HTMLElement>('[role="button"]');
		expect(header).not.toBeNull();

		// Manually expand the section via the user clicking the header.
		await user.click(header!);
		expect(header).toHaveAttribute("aria-expanded", "true");

		await user.click(screen.getByTestId("prisma-event-btn-add-custom-prop-display"));

		// Section must remain expanded — the button click must NOT bubble to the header.
		expect(header).toHaveAttribute("aria-expanded", "true");
		expect(getRows().length).toBe(1);
	});

	it("Add property keeps section expanded across multiple presses", async () => {
		const user = userEvent.setup();
		render(<Harness section="other" name="customPropertiesOther" />);

		const wrapper = screen.getByTestId("prisma-event-custom-props-other");
		const header = wrapper.querySelector<HTMLElement>('[role="button"]');
		const addBtn = screen.getByTestId("prisma-event-btn-add-custom-prop-other");

		await user.click(addBtn); // expands + 1 row
		await user.click(addBtn); // stays expanded, 2 rows
		await user.click(addBtn); // stays expanded, 3 rows

		expect(header).toHaveAttribute("aria-expanded", "true");
		expect(getRows("other").length).toBe(3);
	});

	it("removes a row and updates the record", async () => {
		const user = userEvent.setup();
		let lastRecord: Record<string, string> = {};
		render(
			<Harness
				section="display"
				name="customPropertiesDisplay"
				initial={[
					{ key: "project", value: "Alpha" },
					{ key: "priority", value: "High" },
				]}
				onChange={(r) => {
					lastRecord = r;
				}}
			/>
		);
		await expandSection(user);

		const removeBtns = screen.getAllByTestId("prisma-event-btn-remove-custom-prop-display");
		await user.click(removeBtns[0]);

		expect(getRows().length).toBe(1);
		expect(lastRecord).toEqual({ priority: "High" });
	});
});

describe("customPropertiesToRecord", () => {
	it("flattens entries into a record, dropping empty keys", () => {
		expect(
			customPropertiesToRecord([
				{ key: "a", value: "1" },
				{ key: "", value: "ignored" },
				{ key: "b", value: "2" },
			])
		).toEqual({ a: "1", b: "2" });
	});
});
