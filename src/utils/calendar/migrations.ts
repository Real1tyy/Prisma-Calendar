import { migrateLegacyLoggingLevel } from "@real1ty/obsidian-plugins";
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

/**
 * The old memory-and-sinks `logging.minLevel` becomes `logging.fileLevel`
 * ([[decision-debug-logs-are-always-retained-in-memory-and-hidden-by-default]]).
 */
function migrateLoggingFileLevel(data: RawSettings): boolean {
	if (!migrateLegacyLoggingLevel(data["logging"])) return false;
	log.info("settings", "Moved the logging level to the file level", { logging: data["logging"] });
	return true;
}

/** The single-day all-day property this calendar was created with, before `Start Day` became the default. */
const LEGACY_START_DAY_PROP = "Date";

/** Old settings key → new key; `propertyOrder` stores these keys too. */
const RENAMED_TEMPORAL_KEYS: Readonly<Record<string, string>> = {
	dateProp: "startDayProp",
	startProp: "startDateProp",
	endProp: "endDateProp",
};

function isUsableName(value: unknown): value is string {
	return typeof value === "string" && value.trim() !== "";
}

/**
 * The temporal keys become `startDateProp` / `endDateProp` / `startDayProp`,
 * pairing by event type ([[decision-all-day-events-use-start-day-and-end-day]]).
 * Every stored calendar predates the rename, so one that never saved `dateProp`
 * read the old `Date` default and keeps it — only calendars created afterwards
 * get `Start Day`. The timed defaults did not change, so an absent `startProp` /
 * `endProp` stays absent. `startDayProp` is always written, which marks the
 * calendar as migrated.
 */
function migrateTemporalPropKeys(data: RawSettings): boolean {
	const calendars = data["calendars"];
	if (!Array.isArray(calendars)) return false;

	let migrated = 0;
	for (const cal of calendars as unknown[]) {
		if (!isObject(cal) || typeof cal["startDayProp"] === "string") continue;
		for (const [oldKey, newKey] of Object.entries(RENAMED_TEMPORAL_KEYS)) {
			const legacy = cal[oldKey];
			if (cal[newKey] === undefined && isUsableName(legacy)) cal[newKey] = legacy;
			delete cal[oldKey];
		}
		if (!isUsableName(cal["startDayProp"])) cal["startDayProp"] = LEGACY_START_DAY_PROP;
		const order = cal["propertyOrder"];
		if (Array.isArray(order)) {
			cal["propertyOrder"] = order.map((key: unknown) =>
				typeof key === "string" ? (RENAMED_TEMPORAL_KEYS[key] ?? key) : key
			);
		}
		migrated++;
	}

	if (migrated === 0) return false;
	log.info("settings", "Renamed the temporal property settings, keeping each calendar's property names", {
		calendars: migrated,
	});
	return true;
}

/** In the order they were introduced — a later step may rely on an earlier one's shape. */
const SETTINGS_MIGRATIONS: readonly SettingsMigration[] = [
	migrateSharedExcludedProps,
	migrateLoggingFileLevel,
	migrateTemporalPropKeys,
];

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
