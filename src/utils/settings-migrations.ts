import type { Plugin } from "obsidian";

/**
 * Migrates the shared `excludedRecurringPropagatedProps` setting into three per-type fields.
 * Runs on raw JSON before Zod parsing so the old field is still accessible.
 */
export async function migrateSharedExcludedProps(plugin: Plugin): Promise<void> {
	const raw = await plugin.loadData();
	if (!raw?.calendars || !Array.isArray(raw.calendars)) return;

	let changed = false;
	for (const cal of raw.calendars) {
		const shared = cal.excludedRecurringPropagatedProps;
		if (!shared) continue;

		if (!cal.excludedRecurringInstanceProps) cal.excludedRecurringInstanceProps = shared;
		if (!cal.excludedNameSeriesProps) cal.excludedNameSeriesProps = shared;
		if (!cal.excludedCategorySeriesProps) cal.excludedCategorySeriesProps = shared;
		delete cal.excludedRecurringPropagatedProps;
		changed = true;
	}

	if (changed) await plugin.saveData(raw);
}
