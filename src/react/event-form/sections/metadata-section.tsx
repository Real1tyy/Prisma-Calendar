import { Toggle } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback } from "react";

import type { SingleCalendarConfig } from "../../../types/settings";
import { PrismaSettingItem } from "../prisma-setting-item";

interface MetadataField {
	key: string;
	guard: keyof SingleCalendarConfig;
	label: string;
	description?: string;
	kind: "text" | "number" | "toggle";
	placeholder?: string;
}

const FIELDS: readonly MetadataField[] = [
	{ key: "location", guard: "locationProp", label: "Location", kind: "text", placeholder: "Event location" },
	{ key: "icon", guard: "iconProp", label: "Icon", kind: "text", placeholder: "Emoji or text" },
	{ key: "breakMinutes", guard: "breakProp", label: "Break minutes", kind: "number", placeholder: "0" },
	{ key: "markAsDone", guard: "statusProperty", label: "Mark as done", kind: "toggle" },
	{ key: "skip", guard: "skipProp", label: "Skip", description: "Hide event from calendar", kind: "toggle" },
];

interface FieldRenderProps {
	field: MetadataField;
	value: unknown;
	onChange: (key: string, value: unknown) => void;
}

const MetadataToggleField = memo(function MetadataToggleField({ field, value, onChange }: FieldRenderProps) {
	return (
		<PrismaSettingItem
			name={field.label}
			{...(field.description ? { description: field.description } : {})}
			testId={`prisma-event-field-${field.key}`}
		>
			<Toggle
				value={Boolean(value)}
				onChange={(v) => onChange(field.key, v)}
				testId={`prisma-event-control-${field.key}`}
			/>
		</PrismaSettingItem>
	);
});

const MetadataInputField = memo(function MetadataInputField({ field, value, onChange }: FieldRenderProps) {
	const isNumber = field.kind === "number";
	const stringValue = String(value ?? "");
	return (
		<PrismaSettingItem
			name={field.label}
			{...(field.description ? { description: field.description } : {})}
			testId={`prisma-event-field-${field.key}`}
		>
			<input
				type={isNumber ? "number" : "text"}
				className="prisma-setting-item-control"
				placeholder={field.placeholder ?? ""}
				value={stringValue}
				onChange={(e) => onChange(field.key, e.target.value)}
				data-testid={`prisma-event-control-${field.key}`}
				{...(isNumber ? { min: 0, step: 1 } : {})}
			/>
		</PrismaSettingItem>
	);
});

interface MetadataSectionProps {
	settings: SingleCalendarConfig;
	values: Record<string, unknown>;
	onChange: (values: Record<string, unknown>) => void;
}

export const MetadataSection = memo(function MetadataSection({ settings, values, onChange }: MetadataSectionProps) {
	const visibleFields = FIELDS.filter((f) => Boolean(settings[f.guard]));

	const updateField = useCallback(
		(key: string, value: unknown) => {
			onChange({ ...values, [key]: value });
		},
		[onChange, values]
	);

	if (visibleFields.length === 0) return null;

	return (
		<>
			{visibleFields.map((field) =>
				field.kind === "toggle" ? (
					<MetadataToggleField key={field.key} field={field} value={values[field.key]} onChange={updateField} />
				) : (
					<MetadataInputField key={field.key} field={field} value={values[field.key]} onChange={updateField} />
				)
			)}
		</>
	);
});
