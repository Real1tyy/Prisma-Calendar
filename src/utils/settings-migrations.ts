import type { Plugin } from "obsidian";

interface LegacyCalendar {
	excludedRecurringPropagatedProps?: unknown;
	excludedRecurringInstanceProps?: unknown;
	excludedNameSeriesProps?: unknown;
	excludedCategorySeriesProps?: unknown;
}

interface LegacyData {
	calendars?: LegacyCalendar[];
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Migrates the shared `excludedRecurringPropagatedProps` setting into three per-type fields.
 * Runs on raw JSON before Zod parsing so the old field is still accessible.
 */
export async function migrateSharedExcludedProps(plugin: Plugin): Promise<void> {
	const raw: unknown = await plugin.loadData();
	if (!isObject(raw)) return;

	const data = raw as LegacyData;
	if (!Array.isArray(data.calendars)) return;

	let changed = false;
	for (const cal of data.calendars) {
		const shared = cal.excludedRecurringPropagatedProps;
		if (!shared) continue;

		if (!cal.excludedRecurringInstanceProps) cal.excludedRecurringInstanceProps = shared;
		if (!cal.excludedNameSeriesProps) cal.excludedNameSeriesProps = shared;
		if (!cal.excludedCategorySeriesProps) cal.excludedCategorySeriesProps = shared;
		delete cal.excludedRecurringPropagatedProps;
		changed = true;
	}

	if (changed) await plugin.saveData(data);
}
