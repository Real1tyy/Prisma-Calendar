import { showSchemaFormModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { z } from "zod";

import { CSS_PREFIX } from "../../../constants";
import type { EventPreset } from "../../../types/settings";

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

const PresetShape = {
	saveTo: z.string(),
	presetName: z.string().min(1),
};

export function showSavePresetModal(
	app: App,
	existingPresets: EventPreset[],
	blockCreateNew: boolean,
	onSave: (name: string, overridePresetId: string | null) => void
): void {
	const defaultSaveTo = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].id : "";
	const defaultName = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].name : "";

	showSchemaFormModal({
		app,
		prefix: CSS_PREFIX,
		cls: "prisma-save-preset-modal",
		title: "Save as preset",
		shape: PresetShape,
		submitText: "Save",
		existing: { saveTo: defaultSaveTo, presetName: defaultName },
		fieldOverrides: {
			saveTo: { label: "Save to", options: buildSaveToOptions(existingPresets, blockCreateNew) },
			presetName: { label: "Preset name", placeholder: "e.g., 30 min meeting, All-day event" },
		},
		onSubmit: (values) => onSave(values.presetName, values.saveTo || null),
	});
}
