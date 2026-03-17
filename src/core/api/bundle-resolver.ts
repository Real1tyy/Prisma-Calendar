import { Notice } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import type { CalendarBundle } from "../calendar-bundle";

export function resolveBundle(plugin: CustomCalendarPlugin, calendarId?: string): CalendarBundle | null {
	if (plugin.calendarBundles.length === 0) {
		return null;
	}

	if (calendarId) {
		return plugin.calendarBundles.find((bundle) => bundle.calendarId === calendarId) ?? null;
	}

	const lastUsedCalendarId = plugin.syncStore.data.lastUsedCalendarId;
	if (lastUsedCalendarId) {
		const lastUsedBundle = plugin.calendarBundles.find((bundle) => bundle.calendarId === lastUsedCalendarId);
		if (lastUsedBundle) {
			return lastUsedBundle;
		}
	}

	return plugin.calendarBundles[0] ?? null;
}

export function resolveBundleOrNotice(plugin: CustomCalendarPlugin, calendarId?: string): CalendarBundle | null {
	const bundle = resolveBundle(plugin, calendarId);
	if (!bundle) {
		new Notice("No calendars available");
		return null;
	}
	return bundle;
}

export function isCalendarViewFocused(plugin: CustomCalendarPlugin): boolean {
	return plugin.calendarBundles.some((bundle) => bundle.viewRef.calendarComponent !== null);
}
