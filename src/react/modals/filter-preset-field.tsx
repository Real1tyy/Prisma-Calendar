import { Dropdown, type SchemaFormFieldOverride } from "@real1ty/obsidian-plugins-react";
import { useMemo } from "react";
import { useController, type UseFormReturn } from "react-hook-form";

import type { EventFilterFormFields } from "../../components/settings/integration-shared";
import type { FilterPreset, PrismaCalendarSettingsStore } from "../../types/settings";
import { getCalendarById } from "../../utils/calendar/settings";

const FILTER_EXPRESSION_FIELD: keyof typeof EventFilterFormFields = "filterExpression";

export function filterPresetOptions(presets: FilterPreset[]): Record<string, string> {
	if (presets.length === 0) return { "": "No presets — add them in Settings → Rules" };
	return { "": "None", ...Object.fromEntries(presets.map((p) => [p.name, p.name])) };
}

interface FilterPresetDropdownProps {
	form: UseFormReturn;
	name: string;
	presets: FilterPreset[];
	testId: string;
}

/**
 * Picking a preset copies its expression into the expression field, on the
 * change event — the same copy semantics as the calendar view's preset
 * selector, so editing a preset later never silently changes a saved filter.
 */
function FilterPresetDropdown({ form, name, presets, testId }: FilterPresetDropdownProps) {
	const { field } = useController({ control: form.control, name });
	const options = useMemo(() => filterPresetOptions(presets), [presets]);

	const handleChange = (value: string) => {
		field.onChange(value);
		const preset = presets.find((p) => p.name === value);
		if (preset) form.setValue(FILTER_EXPRESSION_FIELD, preset.expression, { shouldDirty: true });
	};

	return <Dropdown value={String(field.value ?? "")} options={options} onChange={handleChange} testId={testId} />;
}

export function filterPresetFieldOverride(presets: FilterPreset[], testId: string): SchemaFormFieldOverride {
	return {
		render: ({ form, name }) => <FilterPresetDropdown form={form} name={name} presets={presets} testId={testId} />,
	};
}

export function useCalendarFilterPresets(
	settingsStore: PrismaCalendarSettingsStore,
	calendarId: string
): FilterPreset[] {
	return useMemo(
		() => getCalendarById(settingsStore.currentSettings, calendarId)?.filterPresets ?? [],
		[settingsStore, calendarId]
	);
}
