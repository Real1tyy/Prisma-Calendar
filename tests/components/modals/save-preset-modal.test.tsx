import { SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { EventPreset } from "../../../src/types/settings";

const PresetSchema = z.object({
	saveTo: z.string(),
	presetName: z.string().min(1, "Preset name is required"),
});

const MOCK_PRESETS: EventPreset[] = [
	{ id: "p1", name: "30 min meeting" },
	{ id: "p2", name: "All-day event" },
] as EventPreset[];

function buildSaveToOptions(existingPresets: EventPreset[], blockCreateNew: boolean): Record<string, string> {
	const options: Record<string, string> = {};
	if (!blockCreateNew) {
		options[""] = "Create new preset";
	}
	for (const preset of existingPresets) {
		options[preset.id] = `Override: ${preset.name}`;
	}
	return options;
}

function TestSavePresetForm({
	existingPresets = MOCK_PRESETS,
	blockCreateNew = false,
	onSubmit = vi.fn(),
}: {
	existingPresets?: EventPreset[];
	blockCreateNew?: boolean;
	onSubmit?: (values: z.infer<typeof PresetSchema>) => void;
}) {
	const defaultSaveTo = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].id : "";
	const defaultName = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].name : "";

	const form = useZodForm({
		schema: PresetSchema,
		defaultValues: { saveTo: defaultSaveTo, presetName: defaultName },
	});

	return (
		<form onSubmit={form.handleSubmit(onSubmit)}>
			<SchemaForm
				form={form}
				schema={PresetSchema}
				fieldOverrides={{
					saveTo: { label: "Save to", options: buildSaveToOptions(existingPresets, blockCreateNew) },
					presetName: { label: "Preset name", placeholder: "e.g., 30 min meeting" },
				}}
				testIdPrefix="prisma-form-"
			/>
			<button type="submit" data-testid="submit">
				Save
			</button>
		</form>
	);
}

describe("SavePresetModal (React canary)", () => {
	it("renders Save to dropdown and Preset name field", () => {
		render(<TestSavePresetForm />);

		expect(screen.getByText("Save to")).toBeTruthy();
		expect(screen.getByText("Preset name")).toBeTruthy();
	});

	it("shows 'Create new preset' option when not blocked", () => {
		render(<TestSavePresetForm blockCreateNew={false} />);

		const dropdown = screen.getByTestId("prisma-form-control-saveTo");
		const optionEls = dropdown.querySelectorAll("option");
		const options = Array.from(optionEls).map((o) => o.textContent);
		expect(options).toContain("Create new preset");
		expect(options).toContain("Override: 30 min meeting");
	});

	it("hides 'Create new preset' when blocked", () => {
		render(<TestSavePresetForm blockCreateNew={true} />);

		const dropdown = screen.getByTestId("prisma-form-control-saveTo");
		const optionEls = dropdown.querySelectorAll("option");
		const options = Array.from(optionEls).map((o) => o.textContent);
		expect(options).not.toContain("Create new preset");
	});

	it("blocks submit when preset name is empty", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();

		render(<TestSavePresetForm onSubmit={onSubmit} />);
		await user.click(screen.getByTestId("submit"));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(await screen.findByText("Preset name is required")).toBeTruthy();
	});

	it("submits with valid data", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();

		render(<TestSavePresetForm onSubmit={onSubmit} />);

		const nameInput = screen.getByTestId("prisma-form-control-presetName") as HTMLInputElement;
		await user.type(nameInput, "Weekly Review");
		await user.click(screen.getByTestId("submit"));

		expect(onSubmit).toHaveBeenCalled();
		const callArgs = onSubmit.mock.calls[0][0];
		expect(callArgs).toMatchObject({ presetName: "Weekly Review", saveTo: "" });
	});

	it("defaults to first preset when blockCreateNew is true", () => {
		render(<TestSavePresetForm blockCreateNew={true} />);

		const dropdown = screen.getByTestId("prisma-form-control-saveTo") as HTMLSelectElement;
		expect(dropdown.value).toBe("p1");

		const nameInput = screen.getByTestId("prisma-form-control-presetName") as HTMLInputElement;
		expect(nameInput.value).toBe("30 min meeting");
	});
});
