import { readPluginData } from "@real1ty-obsidian-plugins/testing/e2e";

// Prisma persists per-calendar UI state (pageHeaderState, activeTab,
// contextMenuState, …) under `data.calendars[N]`, keyed by id. Every shared
// spec needs to read "the default calendar entry" after `settleSettings`;
// this helper centralises the `find(id === "default") ?? [0]` fallback so the
// specs can describe what they're asserting, not how to get there.

const PLUGIN_ID = "prisma-calendar";
const DEFAULT_CALENDAR_ID = "default";

type CalendarEntry<Extra extends Record<string, unknown> = Record<string, unknown>> = { id: string } & Extra;

export type { CalendarEntry };

/**
 * Read `data.json`, then return the default calendar entry (by id, falling
 * back to the first). The generic narrows the return type so callers get the
 * plugin-specific shape they care about without casting at every call site.
 */
export function readDefaultCalendar<Extra extends Record<string, unknown>>(
	vaultDir: string
): CalendarEntry<Extra> | undefined {
	const data = readPluginData(vaultDir, PLUGIN_ID) as {
		calendars?: Array<CalendarEntry<Extra>>;
	};
	const calendars = data.calendars;
	return calendars?.find((c) => c.id === DEFAULT_CALENDAR_ID) ?? calendars?.[0];
}

export function getCalendars<Extra extends Record<string, unknown> = Record<string, unknown>>(
	vaultDir: string
): Array<CalendarEntry<Extra>> {
	const data = readPluginData(vaultDir, PLUGIN_ID) as {
		calendars?: Array<CalendarEntry<Extra>>;
	};
	return data.calendars ?? [];
}
