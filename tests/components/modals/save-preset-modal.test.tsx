import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SavePresetForm } from "../../../src/react/modals/event/save-preset-modal";
import type { EventPreset } from "../../../src/types/settings";

const MOCK_PRESETS: EventPreset[] = [
	{ id: "p1", name: "30 min meeting" },
	{ id: "p2", name: "All-day event" },
] as EventPreset[];

function setup(overrides: { existingPresets?: EventPreset[]; blockCreateNew?: boolean } = {}) {
	const onSubmit = vi.fn();
	const onCancel = vi.fn();
	const user = userEvent.setup();
	const result = render(
		<SavePresetForm
			existingPresets={overrides.existingPresets ?? MOCK_PRESETS}
			blockCreateNew={overrides.blockCreateNew ?? false}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
	return { onSubmit, onCancel, user, ...result };
}

describe("SavePresetForm", () => {
	it("renders Save to dropdown and Preset name field", () => {
		setup();
		expect(screen.getByText("Save to")).toBeTruthy();
		expect(screen.getByText("Preset name")).toBeTruthy();
	});

	it("shows 'Create new preset' option when not blocked", () => {
		setup();
		const dropdown = screen.getByTestId("prisma-save-preset-control-saveTo");
		const options = Array.from(dropdown.querySelectorAll("option")).map((o) => o.textContent);
		expect(options).toContain("Create new preset");
		expect(options).toContain("Override: 30 min meeting");
	});

	it("hides 'Create new preset' when blocked", () => {
		setup({ blockCreateNew: true });
		const dropdown = screen.getByTestId("prisma-save-preset-control-saveTo");
		const options = Array.from(dropdown.querySelectorAll("option")).map((o) => o.textContent);
		expect(options).not.toContain("Create new preset");
	});

	it("submits with valid data", async () => {
		const { user, onSubmit } = setup();
		const nameInput = screen.getByTestId("prisma-save-preset-control-presetName") as HTMLInputElement;
		await user.type(nameInput, "Weekly Review");
		await user.click(screen.getByTestId("prisma-form-submit"));

		expect(onSubmit).toHaveBeenCalled();
		const data = onSubmit.mock.calls[0][0] as { presetName: string; saveTo: string };
		expect(data.presetName).toBe("Weekly Review");
		expect(data.saveTo).toBe("");
	});

	it("defaults to first preset when blockCreateNew is true", () => {
		setup({ blockCreateNew: true });
		const dropdown = screen.getByTestId("prisma-save-preset-control-saveTo") as HTMLSelectElement;
		expect(dropdown.value).toBe("p1");
		const nameInput = screen.getByTestId("prisma-save-preset-control-presetName") as HTMLInputElement;
		expect(nameInput.value).toBe("30 min meeting");
	});
});
