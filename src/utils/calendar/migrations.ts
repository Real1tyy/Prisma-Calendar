import type { Plugin } from "obsidian";

import { log } from "../../core/logging";

interface LegacyCalendar {
	excludedRecurringPropagatedProps?: unknown;
	excludedRecurringInstanceProps?: unknown;
	excludedNameSeriesProps?: unknown;
	excludedCategorySeriesProps?: unknown;
}

type RawSettings = Record<string, unknown>;

/** One step over the raw stored settings; returns whether it changed anything. */
type SettingsMigration = (data: RawSettings) => boolean;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** The shared `excludedRecurringPropagatedProps` setting becomes three per-type fields. */
function migrateSharedExcludedProps(data: RawSettings): boolean {
	const calendars = data["calendars"];
	if (!Array.isArray(calendars)) return false;

	let migrated = 0;
	for (const cal of calendars as LegacyCalendar[]) {
		const shared = cal.excludedRecurringPropagatedProps;
		if (!shared) continue;

		if (!cal.excludedRecurringInstanceProps) cal.excludedRecurringInstanceProps = shared;
		if (!cal.excludedNameSeriesProps) cal.excludedNameSeriesProps = shared;
		if (!cal.excludedCategorySeriesProps) cal.excludedCategorySeriesProps = shared;
		delete cal.excludedRecurringPropagatedProps;
		migrated++;
	}

	if (migrated === 0) return false;
	log.info("settings", "Migrated excludedRecurringPropagatedProps into the three per-type fields", {
		calendars: migrated,
	});
	return true;
}

/** In the order they were introduced — a later step may rely on an earlier one's shape. */
const SETTINGS_MIGRATIONS: readonly SettingsMigration[] = [migrateSharedExcludedProps];

/**
 * Runs every stored-settings migration on the raw JSON before the Zod parse,
 * which would otherwise drop the old keys. Loads once and saves once, only when
 * some step changed something.
 */
export async function migrateSettings(plugin: Pick<Plugin, "loadData" | "saveData">): Promise<void> {
	const raw: unknown = await plugin.loadData();
	if (!isObject(raw)) return;

	let changed = false;
	for (const migrate of SETTINGS_MIGRATIONS) {
		if (migrate(raw)) changed = true;
	}
	if (changed) await plugin.saveData(raw);
}
