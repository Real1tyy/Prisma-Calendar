import { toLocalISOString } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfig } from "../../types";
import {
	aggregateStats,
	type AggregationMode,
	formatDuration,
	formatDurationAsDecimalHours,
	formatPercentage,
	getDayBounds,
	getMonthBounds,
	getWeekBounds,
} from "../../utils/stats";
import type { CalendarBundle } from "../calendar-bundle";
import { resolveBundle, resolveBundleOrNotice } from "./bundle-resolver";
import type {
	PrismaCalendarIdInput,
	PrismaCalendarInfo,
	PrismaStatEntry,
	PrismaStatisticsInput,
	PrismaStatisticsOutput,
	PrismaUpdateSettingsInput,
} from "./types";

function bundleToCalendarInfo(bundle: CalendarBundle): PrismaCalendarInfo {
	const settings = bundle.settingsStore.currentSettings;
	return {
		calendarId: bundle.calendarId,
		name: settings.name,
		directory: settings.directory,
		enabled: true,
		eventCount: bundle.eventStore.getAllEvents().length,
		untrackedEventCount: bundle.untrackedEventStore.getUntrackedEvents().length,
	};
}

export function refreshCalendar(plugin: CustomCalendarPlugin, input?: PrismaCalendarIdInput): void {
	const bundle = resolveBundleOrNotice(plugin, input?.calendarId);
	if (!bundle) return;
	bundle.refreshCalendar();
}

export function getCalendarInfo(
	plugin: CustomCalendarPlugin,
	input?: PrismaCalendarIdInput
): PrismaCalendarInfo | null {
	const bundle = resolveBundle(plugin, input?.calendarId);
	if (!bundle) return null;
	return bundleToCalendarInfo(bundle);
}

export function listCalendars(plugin: CustomCalendarPlugin): PrismaCalendarInfo[] {
	return plugin.calendarBundles.map(bundleToCalendarInfo);
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
	const mode: AggregationMode = input?.mode ?? settings.defaultAggregationMode;

	const bounds =
		interval === "day" ? getDayBounds(date) : interval === "month" ? getMonthBounds(date) : getWeekBounds(date);

	const query = { start: toLocalISOString(bounds.start), end: toLocalISOString(bounds.end) };
	const events = await bundle.eventStore.getEvents(query);
	const skippedCount = bundle.eventStore.countSkippedEvents(query);

	let timedEvents = 0;
	let allDayEvents = 0;
	let doneEvents = 0;
	let undoneEvents = 0;

	for (const event of events) {
		if (event.type === "timed") timedEvents++;
		else allDayEvents++;

		if (settings.statusProperty && event.metadata.status) {
			if (event.metadata.status === settings.doneValue) doneEvents++;
			else if (event.metadata.status === settings.notDoneValue) undoneEvents++;
		}
	}

	const stats = aggregateStats(events, bounds.start, bounds.end, mode, settings.categoryProp);
	const formatFn = settings.showDecimalHours ? formatDurationAsDecimalHours : formatDuration;

	const entries: PrismaStatEntry[] = stats.entries.map((entry) => ({
		name: entry.name,
		duration: entry.duration,
		durationFormatted: formatFn(entry.duration),
		percentage: formatPercentage(entry.duration, stats.totalDuration),
		count: entry.count,
		isRecurring: entry.isRecurring,
	}));

	return {
		periodStart: toLocalISOString(bounds.start),
		periodEnd: toLocalISOString(bounds.end),
		interval,
		mode,
		totalDuration: stats.totalDuration,
		totalDurationFormatted: formatFn(stats.totalDuration),
		totalEvents: events.length,
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
