import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { MetadataSection } from "../../../src/react/event-form/sections/metadata-section";
import type { SingleCalendarConfig } from "../../../src/types/settings";
import { createMockSingleCalendarSettings } from "../../fixtures/settings-fixtures";

function makeSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return { ...createMockSingleCalendarSettings(), ...overrides } as SingleCalendarConfig;
}

function Harness({
	settings,
	initialValues = {},
	onChangeSpy,
}: {
	settings: SingleCalendarConfig;
	initialValues?: Record<string, unknown>;
	onChangeSpy?: (v: Record<string, unknown>) => void;
}) {
	const [values, setValues] = useState<Record<string, unknown>>({
		location: "",
		icon: "",
		breakMinutes: "",
		markAsDone: false,
		skip: false,
		...initialValues,
	});
	return (
		<MetadataSection
			settings={settings}
			values={values}
			onChange={(v) => {
				setValues(v);
				onChangeSpy?.(v);
			}}
		/>
	);
}

describe("MetadataSection", () => {
	it("renders nothing when no metadata-property guards are configured", () => {
		const settings = makeSettings({
			locationProp: "",
			iconProp: "",
			breakProp: "",
			statusProperty: "",
			skipProp: "",
		});
		const { container } = render(<Harness settings={settings} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders only the fields whose property guards are set", () => {
		const settings = makeSettings({
			locationProp: "Location",
			iconProp: "",
			breakProp: "",
			statusProperty: "",
			skipProp: "",
		});
		render(<Harness settings={settings} />);
		expect(screen.getByTestId("prisma-event-control-location")).toBeTruthy();
		expect(screen.queryByTestId("prisma-event-control-icon")).toBeNull();
		expect(screen.queryByTestId("prisma-event-control-breakMinutes")).toBeNull();
	});

	it("renders all metadata fields when every property guard is set", () => {
		const settings = makeSettings({
			locationProp: "Location",
			iconProp: "Icon",
			breakProp: "Break",
			statusProperty: "Status",
			skipProp: "Skip",
		});
		render(<Harness settings={settings} />);
		expect(screen.getByTestId("prisma-event-control-location")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-icon")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-breakMinutes")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-markAsDone")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-skip")).toBeTruthy();
	});

	it("propagates field edits via onChange", async () => {
		const onChangeSpy = vi.fn();
		const settings = makeSettings({ locationProp: "Location", iconProp: "Icon" });
		render(<Harness settings={settings} onChangeSpy={onChangeSpy} />);

		const user = userEvent.setup();
		const locInput = screen.getByTestId("prisma-event-control-location") as HTMLInputElement;
		await user.type(locInput, "Office");

		expect(onChangeSpy).toHaveBeenCalled();
		const last = onChangeSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
		expect(last["location"]).toBe("Office");
	});
});
