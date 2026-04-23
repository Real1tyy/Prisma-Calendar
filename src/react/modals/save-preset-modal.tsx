import { openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { z } from "zod";

import type { EventPreset } from "../../types/settings";

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

const PresetSchema = z.object({
	saveTo: z.string(),
	presetName: z.string().min(1, "Preset name is required"),
});

type PresetValues = z.infer<typeof PresetSchema>;

function SavePresetForm({
	existingPresets,
	blockCreateNew,
	onSubmit,
	onCancel,
}: {
	existingPresets: EventPreset[];
	blockCreateNew: boolean;
	onSubmit: (values: PresetValues) => void;
	onCancel: () => void;
}) {
	const defaultSaveTo = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].id : "";
	const defaultName = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].name : "";

	const form = useZodForm({
		schema: PresetSchema,
		defaultValues: { saveTo: defaultSaveTo, presetName: defaultName },
	});

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="prisma-save-preset-form">
			<SchemaForm
				form={form}
				schema={PresetSchema}
				fieldOverrides={{
					saveTo: { label: "Save to", options: buildSaveToOptions(existingPresets, blockCreateNew) },
					presetName: { label: "Preset name", placeholder: "e.g., 30 min meeting, All-day event" },
				}}
				testIdPrefix="prisma-form-"
			/>
			<div className="modal-button-container">
				<button type="button" className="mod-cancel" onClick={onCancel} data-testid="prisma-form-cancel">
					Cancel
				</button>
				<button type="submit" className="mod-cta" data-testid="prisma-form-submit">
					Save
				</button>
			</div>
		</form>
	);
}

export function showSavePresetReactModal(
	app: App,
	existingPresets: EventPreset[],
	blockCreateNew: boolean,
	onSave: (name: string, overridePresetId: string | null) => void
): void {
	void openReactModal<PresetValues>({
		app,
		cls: "prisma-save-preset-modal",
		title: "Save as preset",
		render: (submit, cancel) => (
			<SavePresetForm
				existingPresets={existingPresets}
				blockCreateNew={blockCreateNew}
				onSubmit={(values) => {
					onSave(values.presetName, values.saveTo || null);
					submit(values);
				}}
				onCancel={cancel}
			/>
		),
	});
}
