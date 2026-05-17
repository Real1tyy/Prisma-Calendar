import { toLocalISOString } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfig } from "../../types";
import { buildStatsSnapshot, formatPercentage, pickDurationFormatter } from "../../utils/stats";
import { resolveBundle, resolveBundleOrNotice } from "./bundle-resolver";
import type {
	PrismaCalendarIdInput,
	PrismaCalendarInfo,
	PrismaStatEntry,
	PrismaStatisticsInput,
	PrismaStatisticsOutput,
	PrismaUpdateSettingsInput,
} from "./types";

export function getCalendarInfo(
	plugin: CustomCalendarPlugin,
	input?: PrismaCalendarIdInput
): PrismaCalendarInfo | null {
	const bundle = resolveBundle(plugin, input?.calendarId);
	return bundle?.getInfo() ?? null;
}

export function listCalendars(plugin: CustomCalendarPlugin): PrismaCalendarInfo[] {
	return plugin.calendarBundles.map((bundle) => bundle.getInfo());
}

export async function getStatistics(
	plugin: CustomCalendarPlugin,
	input?: PrismaStatisticsInput
): Promise<PrismaStatisticsOutput | null> {
	const bundle = resolveBundle(plugin, input?.calendarId);
	if (!bundle) return null;

	const settings = bundle.settingsStore.currentSettings;
	const date = input?.date ? new Date(input.date) : new Date();
	if (isNaN(date.getTime())) return null;

	const interval = input?.interval ?? "week";
	const mode = input?.mode ?? settings.defaultAggregationMode;
	const snapshot = await buildStatsSnapshot(bundle.eventStore, {
		date,
		interval,
		mode,
		categoryProp: settings.categoryProp,
	});
	const skippedCount = bundle.eventStore.countSkippedEvents({
		start: toLocalISOString(snapshot.bounds.start),
		end: toLocalISOString(snapshot.bounds.end),
	});

	let timedEvents = 0;
	let allDayEvents = 0;
	let doneEvents = 0;
	let undoneEvents = 0;

	for (const event of snapshot.events) {
		if (event.type === "timed") timedEvents++;
		else allDayEvents++;

		if (settings.statusProperty && event.metadata.status) {
			if (event.metadata.status === settings.doneValue) doneEvents++;
			else if (event.metadata.status === settings.notDoneValue) undoneEvents++;
		}
	}

	const formatFn = pickDurationFormatter(settings);
	const entries: PrismaStatEntry[] = snapshot.stats.entries.map((entry) => ({
		name: entry.name,
		duration: entry.duration,
		durationFormatted: formatFn(entry.duration),
		percentage: formatPercentage(entry.duration, snapshot.stats.totalDuration),
		count: entry.count,
		isRecurring: entry.isRecurring,
	}));

	return {
		periodStart: toLocalISOString(snapshot.bounds.start),
		periodEnd: toLocalISOString(snapshot.bounds.end),
		interval,
		mode,
		totalDuration: snapshot.stats.totalDuration,
		totalDurationFormatted: formatFn(snapshot.stats.totalDuration),
		totalEvents: snapshot.events.length,
		timedEvents,
		allDayEvents,
		skippedEvents: skippedCount,
		doneEvents,
		undoneEvents,
		entries,
	};
}

export function getSettings(plugin: CustomCalendarPlugin, input?: PrismaCalendarIdInput): SingleCalendarConfig | null {
	const bundle = resolveBundle(plugin, input?.calendarId);
	if (!bundle) return null;
	return { ...bundle.settingsStore.currentSettings };
}

export async function updateSettings(plugin: CustomCalendarPlugin, input: PrismaUpdateSettingsInput): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;

	// Strip `undefined` values so a `{ foo: undefined }` patch doesn't clobber an
	// existing required setting. Zod-inferred Partial<T> permits explicit-undefined,
	// but the settings store expects "key present = set, key absent = unchanged."
	const patch: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input.settings)) {
		if (value !== undefined && key !== "id") patch[key] = value;
	}

	await bundle.settingsStore.updateSettings((current) => ({
		...current,
		...patch,
	}));
	return true;
}
