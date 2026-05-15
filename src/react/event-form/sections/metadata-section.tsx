import { memo, useCallback } from "react";

import type { SingleCalendarConfig } from "../../../types/settings";
import { PrismaCheckbox } from "../prisma-checkbox";
import { PrismaSettingItem } from "../prisma-setting-item";

interface MetadataField {
	key: string;
	guard: keyof SingleCalendarConfig;
	label: string;
	description?: string;
	kind: "text" | "number" | "switch";
	placeholder?: string;
}

const FIELDS: readonly MetadataField[] = [
	{ key: "location", guard: "locationProp", label: "Location", kind: "text", placeholder: "Event location" },
	{ key: "icon", guard: "iconProp", label: "Icon", kind: "text", placeholder: "Emoji or text" },
	{
		key: "breakMinutes",
		guard: "breakProp",
		label: "Break minutes",
		description: "Break time in minutes",
		kind: "number",
		placeholder: "0",
	},
	{ key: "markAsDone", guard: "statusProperty", label: "Mark as done", kind: "switch" },
	{ key: "skip", guard: "skipProp", label: "Skip", description: "Hide event from calendar", kind: "switch" },
];

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
			{visibleFields.map((field) => {
				const fieldTestId = `prisma-event-field-${field.key}`;
				const controlTestId = `prisma-event-control-${field.key}`;
				const description = field.description;

				if (field.kind === "switch") {
					return (
						<PrismaSettingItem
							key={field.key}
							name={field.label}
							{...(description ? { description } : {})}
							testId={fieldTestId}
						>
							<PrismaCheckbox
								style="switch"
								value={Boolean(values[field.key])}
								onChange={(v) => updateField(field.key, v)}
								testId={controlTestId}
							/>
						</PrismaSettingItem>
					);
				}

				const isNumber = field.kind === "number";
				const value = String(values[field.key] ?? "");

				return (
					<PrismaSettingItem
						key={field.key}
						name={field.label}
						{...(description ? { description } : {})}
						testId={fieldTestId}
					>
						<input
							type={isNumber ? "number" : "text"}
							className="prisma-setting-item-control"
							placeholder={field.placeholder ?? ""}
							value={value}
							onChange={(e) => updateField(field.key, e.target.value)}
							data-testid={controlTestId}
							{...(isNumber ? { min: 0, step: 1 } : {})}
						/>
					</PrismaSettingItem>
				);
			})}
		</>
	);
});
