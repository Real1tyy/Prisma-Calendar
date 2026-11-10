/**
 * The all-day strip's display modes and the FullCalendar options each one
 * resolves to. Pure and session-scoped — nothing here reaches settings storage,
 * because the mode is deliberately forgotten when the view closes.
 * See [[knowledge-collapsible-mobile-chrome-tab-bar-and-calendar-header]].
 */

/** Cycle order: each press shows more all-day, then nothing but all-day, then none. */
export const ALL_DAY_MODES = ["default", "expanded", "only", "hidden"] as const;

export type AllDayMode = (typeof ALL_DAY_MODES)[number];

export const DEFAULT_ALL_DAY_MODE: AllDayMode = "default";

const ALL_DAY_MODE_LABELS: Record<AllDayMode, string> = {
	default: "All-day",
	expanded: "All-day: full",
	only: "All-day: only",
	hidden: "All-day: off",
};

export interface MaxEventsSettings {
	mobileMaxEventsPerDay: number;
	desktopMaxEventsPerDay: number;
}

export interface AllDayOptions {
	allDaySlot: boolean;
	/** FullCalendar's `dayMaxEvents`: a cap, or `false` for "no cap". */
	dayMaxEvents: number | false;
	/** Drop the per-event height cap so a tall all-day stack renders in full. */
	expanded: boolean;
	/** Hide the time grid, so the all-day strip is the whole view. */
	timedHidden: boolean;
}

export function nextAllDayMode(mode: AllDayMode): AllDayMode {
	const index = ALL_DAY_MODES.indexOf(mode);
	return ALL_DAY_MODES[(index + 1) % ALL_DAY_MODES.length];
}

/** The label doubles as the state readout, so the mode is legible without tapping. */
export function allDayModeLabel(mode: AllDayMode): string {
	return ALL_DAY_MODE_LABELS[mode];
}

/** Both settings document 0 as "unlimited", which FullCalendar spells `false`. */
export function resolveDayMaxEvents(settings: MaxEventsSettings, isMobile: boolean): number | false {
	const cap = isMobile ? settings.mobileMaxEventsPerDay : settings.desktopMaxEventsPerDay;
	return cap > 0 ? cap : false;
}

/** Only `timeGrid` views have an all-day strip; month / year / list have nothing to act on. */
export function isAllDayCapableView(viewType: string): boolean {
	return viewType.startsWith("timeGrid");
}

/**
 * `dayMaxEvents` is a *global* option, so forcing it off for `expanded` has to be
 * scoped to the views that actually own an all-day strip — otherwise month view
 * silently loses its `+N more` too. A non-timeGrid view therefore resolves
 * exactly as `default` does, whatever the remembered mode is.
 */
export function resolveAllDayOptions(
	mode: AllDayMode,
	viewType: string,
	settings: MaxEventsSettings,
	isMobile: boolean
): AllDayOptions {
	const defaultMaxEvents = resolveDayMaxEvents(settings, isMobile);
	const fallback: AllDayOptions = {
		allDaySlot: true,
		dayMaxEvents: defaultMaxEvents,
		expanded: false,
		timedHidden: false,
	};

	if (!isAllDayCapableView(viewType)) return fallback;

	switch (mode) {
		case "expanded":
			return { allDaySlot: true, dayMaxEvents: false, expanded: true, timedHidden: false };
		case "only":
			return { allDaySlot: true, dayMaxEvents: false, expanded: true, timedHidden: true };
		case "hidden":
			return { allDaySlot: false, dayMaxEvents: defaultMaxEvents, expanded: false, timedHidden: false };
		default:
			return fallback;
	}
}
