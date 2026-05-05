import { BehaviorSubject } from "rxjs";

import type { CalendarSettingsStore, ToolbarButtonsKey } from "../../src/core/settings-store";
import type { CustomCalendarSettings, PrismaCalendarSettingsStore } from "../../src/types";
import { CustomCalendarSettingsSchema } from "../../src/types";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createMockSingleCalendarSettings } from "../setup";

/** Factory for parser-style settings with standard property names configured. */
export function createParserSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createMockSingleCalendarSettings(),
		startProp: "Start Date",
		endProp: "End Date",
		dateProp: "Date",
		allDayProp: "All Day",
		titleProp: "Title",
		minutesBeforeProp: "Minutes Before",
		daysBeforeProp: "Days Before",
		categoryProp: "Category",
		...overrides,
	} as SingleCalendarConfig;
}

/** Factory for notification-manager settings with notification-specific defaults. */
export function createNotificationSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createParserSettings(),
		id: "test",
		name: "Test Calendar",
		enabled: true,
		directory: "test-dir",
		enableNotifications: true,
		notificationSound: false,
		defaultMinutesBefore: undefined,
		defaultDaysBefore: undefined,
		alreadyNotifiedProp: "Already Notified",
		...overrides,
	} as SingleCalendarConfig;
}

/**
 * Minimal in-memory CalendarSettingsStore for React component tests. Satisfies
 * the structural contract used by `useSettingsStore` / `useSchemaField` and
 * exposes `toggleToolbarButton` for the configuration tab.
 */
export function createMockCalendarSettingsStore(initial: Partial<SingleCalendarConfig> = {}): CalendarSettingsStore {
	const state: { current: SingleCalendarConfig } = {
		current: { ...createMockSingleCalendarSettings(), ...initial } as SingleCalendarConfig,
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
			const current = state.current[key];
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
	const base = CustomCalendarSettingsSchema.parse({});
	const initial: CustomCalendarSettings = { ...base, calendars };
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
