import { BehaviorSubject } from "rxjs";
import { vi } from "vitest";

import type { CalendarSettingsStore, ToolbarButtonsKey } from "../../src/core/settings-store";
import {
	CustomCalendarSettingsSchema,
	type CustomCalendarSettings,
	type PrismaCalendarSettingsStore,
} from "../../src/types";
import type { SingleCalendarConfig } from "../../src/types/settings";

let cachedDefaults: CustomCalendarSettings | undefined;
function parsedDefaults(): CustomCalendarSettings {
	if (!cachedDefaults) {
		cachedDefaults = CustomCalendarSettingsSchema.parse({});
	}
	return cachedDefaults;
}

let cachedSingleCalendar: SingleCalendarConfig | undefined;
function getDefaultSingleCalendar(): SingleCalendarConfig {
	if (!cachedSingleCalendar) {
		cachedSingleCalendar = parsedDefaults().calendars[0];
	}
	return structuredClone(cachedSingleCalendar);
}

let cachedMainEnvelope: Omit<CustomCalendarSettings, "calendars"> | undefined;
function getDefaultMainEnvelope(): Omit<CustomCalendarSettings, "calendars"> {
	if (!cachedMainEnvelope) {
		const { calendars: _calendars, ...rest } = parsedDefaults();
		cachedMainEnvelope = rest;
	}
	return structuredClone(cachedMainEnvelope);
}

export function createMockSingleCalendarSettings(): SingleCalendarConfig {
	return getDefaultSingleCalendar();
}

export function createMockSingleCalendarSettingsStore(
	calendarOverrides?: Partial<SingleCalendarConfig>
): BehaviorSubject<SingleCalendarConfig> {
	const singleCalendarSettings = getDefaultSingleCalendar();
	const settings = { ...singleCalendarSettings, ...calendarOverrides } as SingleCalendarConfig;
	return new BehaviorSubject(settings);
}

const PARSER_OVERRIDES = {
	startProp: "Start Date",
	endProp: "End Date",
	dateProp: "Date",
	allDayProp: "All Day",
	titleProp: "Title",
	minutesBeforeProp: "Minutes Before",
	daysBeforeProp: "Days Before",
	categoryProp: "Category",
} as const;

let cachedParserSettings: SingleCalendarConfig | undefined;
function getDefaultParserSettings(): SingleCalendarConfig {
	if (!cachedParserSettings) {
		cachedParserSettings = { ...getDefaultSingleCalendar(), ...PARSER_OVERRIDES } as SingleCalendarConfig;
	}
	return structuredClone(cachedParserSettings);
}

/** Factory for parser-style settings with standard property names configured. */
export function createParserSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return { ...getDefaultParserSettings(), ...overrides } as SingleCalendarConfig;
}

const NOTIFICATION_OVERRIDES = {
	id: "test",
	name: "Test Calendar",
	enabled: true,
	directory: "test-dir",
	enableNotifications: true,
	notificationSound: false,
	defaultMinutesBefore: undefined,
	defaultDaysBefore: undefined,
	alreadyNotifiedProp: "Already Notified",
} as const;

let cachedNotificationSettings: SingleCalendarConfig | undefined;
function getDefaultNotificationSettings(): SingleCalendarConfig {
	if (!cachedNotificationSettings) {
		cachedNotificationSettings = { ...getDefaultParserSettings(), ...NOTIFICATION_OVERRIDES } as SingleCalendarConfig;
	}
	return structuredClone(cachedNotificationSettings);
}

/** Factory for notification-manager settings with notification-specific defaults. */
export function createNotificationSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return { ...getDefaultNotificationSettings(), ...overrides } as SingleCalendarConfig;
}

/**
 * Minimal in-memory CalendarSettingsStore for React component tests. Satisfies
 * the structural contract used by `useSettingsStore` / `useSchemaField` and
 * exposes `toggleToolbarButton` for the configuration tab.
 */
export function createMockCalendarSettingsStore(initial: Partial<SingleCalendarConfig> = {}): CalendarSettingsStore {
	const state: { current: SingleCalendarConfig } = {
		current: { ...getDefaultSingleCalendar(), ...initial } as SingleCalendarConfig,
	};
	const subject = new BehaviorSubject(state.current);

	const store = {
		settings$: subject,
		get currentSettings(): SingleCalendarConfig {
			return state.current;
		},
		async updateSettings(updater: (s: SingleCalendarConfig) => SingleCalendarConfig): Promise<void> {
			state.current = updater(state.current);
			subject.next(state.current);
		},
		async toggleToolbarButton(key: ToolbarButtonsKey, buttonId: string, enabled: boolean): Promise<void> {
			const current = state.current[key] as string[];
			const next = enabled
				? current.includes(buttonId)
					? current
					: [...current, buttonId]
				: current.filter((id) => id !== buttonId);
			state.current = { ...state.current, [key]: next };
			subject.next(state.current);
		},
	};

	return store as unknown as CalendarSettingsStore;
}

/**
 * Minimal in-memory PrismaCalendarSettingsStore for unit tests that construct
 * a Parser or IndexerRegistry. Provides functional `updateSettings` so
 * conflict-detection subscriptions wire up correctly.
 */
export function createMockMainSettingsStore(calendars: SingleCalendarConfig[] = []): PrismaCalendarSettingsStore {
	const initial: CustomCalendarSettings = { ...getDefaultMainEnvelope(), calendars } as CustomCalendarSettings;
	const settings$ = new BehaviorSubject<CustomCalendarSettings>(initial);
	return {
		settings$,
		get currentSettings() {
			return settings$.value;
		},
		async updateSettings(updater: (s: CustomCalendarSettings) => CustomCalendarSettings) {
			settings$.next(updater(settings$.value));
		},
	} as unknown as PrismaCalendarSettingsStore;
}

/**
 * Spy-able main-settings store for tests that need to assert on `updateSettings`
 * calls (e.g. the license manager flow). Shape matches `PrismaCalendarSettingsStore`
 * but `updateSettings` is a `vi.fn` and `settings$` is exposed as an Observable
 * (not a BehaviorSubject) — matching the contract the license manager consumes.
 */
export function createMockLicenseSettingsStore(overrides: Partial<CustomCalendarSettings> = {}) {
	const settings = { ...getDefaultMainEnvelope(), calendars: [], ...overrides } as CustomCalendarSettings;
	const subject = new BehaviorSubject<CustomCalendarSettings>(settings);
	return {
		currentSettings: settings,
		settings$: subject.asObservable(),
		updateSettings: vi.fn(async (updater: (s: CustomCalendarSettings) => CustomCalendarSettings) => {
			const next = updater(settings);
			Object.assign(settings, next);
			subject.next(settings);
		}),
	};
}
