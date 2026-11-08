import { useEffect, useMemo } from "react";
import { useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";

import type { FilterPreset, PrismaCalendarSettingsStore } from "../../types/settings";
import { getCalendarById } from "../../utils/calendar/settings";

interface EventFilterValues {
	filterPreset: string;
	filterExpression: string;
}

export function filterPresetOptions(presets: FilterPreset[]): Record<string, string> {
	if (presets.length === 0) return { "": "No presets — add them in Settings → Rules" };
	return { "": "None", ...Object.fromEntries(presets.map((p) => [p.name, p.name])) };
}

/**
 * Copies the picked preset's expression into `filterExpression` — the same
 * copy semantics as the calendar view's preset selector, so editing a preset
 * later never silently changes a saved sync filter. Returns the select options.
 */
export function useFilterPresetFill<T extends FieldValues & EventFilterValues>(
	form: UseFormReturn<T>,
	presets: FilterPreset[]
): Record<string, string> {
	// react-hook-form's path generics can't see that every T carries these two keys.
	const filterForm = form as unknown as UseFormReturn<EventFilterValues>;
	const selected = useWatch({ control: filterForm.control, name: "filterPreset" });

	useEffect(() => {
		if (!selected) return;
		const preset = presets.find((p) => p.name === selected);
		if (preset) filterForm.setValue("filterExpression", preset.expression, { shouldDirty: true });
	}, [selected, presets, filterForm]);

	return useMemo(() => filterPresetOptions(presets), [presets]);
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
