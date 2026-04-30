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
		new Notice("No planning systems available");
		return null;
	}
	return bundle;
}

export async function withBundle<T>(
	plugin: CustomCalendarPlugin,
	calendarId: string | undefined,
	fallback: T,
	fn: (bundle: CalendarBundle) => Promise<T>
): Promise<T> {
	const bundle = resolveBundleOrNotice(plugin, calendarId);
	if (!bundle) return fallback;
	return fn(bundle);
}

export function isCalendarViewFocused(plugin: CustomCalendarPlugin): boolean {
	return plugin.calendarBundles.some((bundle) => bundle.viewRef.calendarComponent !== null);
}
