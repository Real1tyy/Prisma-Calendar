import { ModalSchemaForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useMemo } from "react";
import { z } from "zod";

import { cls, tid } from "../../../constants";
import type { EventPreset } from "../../../types/settings";

const SavePresetSchema = z.object({
	saveTo: z.string().default(""),
	presetName: z.string().min(1).default(""),
});

type SavePresetValues = z.infer<typeof SavePresetSchema>;

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

interface SavePresetFormProps {
	existingPresets: EventPreset[];
	blockCreateNew: boolean;
	onSubmit: (value: SavePresetValues) => void;
	onCancel: () => void;
}

export function SavePresetForm({ existingPresets, blockCreateNew, onSubmit, onCancel }: SavePresetFormProps) {
	const defaultSaveTo = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].id : "";
	const defaultName = blockCreateNew && existingPresets.length > 0 ? existingPresets[0].name : "";

	const form = useZodForm({
		schema: SavePresetSchema,
		defaultValues: { saveTo: defaultSaveTo, presetName: defaultName },
	});

	const saveToOptions = useMemo(
		() => buildSaveToOptions(existingPresets, blockCreateNew),
		[existingPresets, blockCreateNew]
	);

	return (
		<ModalSchemaForm form={form} onSubmit={onSubmit} onCancel={onCancel}>
			<SchemaForm
				form={form}
				schema={SavePresetSchema}
				fieldOverrides={{
					saveTo: { label: "Save to", options: saveToOptions },
					presetName: { label: "Preset name", placeholder: "e.g., 30 min meeting, All-day event" },
				}}
				testIdPrefix={tid("save-preset-")}
			/>
		</ModalSchemaForm>
	);
}

export interface SavePresetResult {
	name: string;
	overridePresetId: string | null;
}

export function openSavePresetModal(
	app: App,
	existingPresets: EventPreset[],
	blockCreateNew: boolean
): Promise<SavePresetResult | null> {
	return openReactModal<SavePresetResult>({
		app,
		title: "Save as preset",
		cls: cls("save-preset-modal"),
		testId: tid("modal-save-preset"),
		render: (submit, cancel) => (
			<SavePresetForm
				existingPresets={existingPresets}
				blockCreateNew={blockCreateNew}
				onSubmit={(values) => {
					submit({ name: values.presetName, overridePresetId: values.saveTo || null });
				}}
				onCancel={cancel}
			/>
		),
	});
}
