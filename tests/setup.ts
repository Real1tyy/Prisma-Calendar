import { BehaviorSubject } from "rxjs";
import { beforeEach, vi } from "vitest";
// Import local mocks
import {
	createMockApp,
	createMockFile,
	debounce,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	TFile,
} from "./mocks/obsidian";
import type { CustomCalendarSettings } from "../src/types/index";
import { CustomCalendarSettingsSchema } from "../src/types/index";

export class Menu {
	addItem(callback: (item: any) => void) {
		const item = {
			setTitle: vi.fn().mockReturnThis(),
			setIcon: vi.fn().mockReturnThis(),
			onClick: vi.fn().mockReturnThis(),
		};
		callback(item);
		return this;
	}
	addSeparator() {
		return this;
	}
	showAtMouseEvent() {}
}

// Re-export centralized mocks for use in tests
export {
	Plugin,
	PluginSettingTab,
	ItemView,
	TFile,
	Notice,
	Modal,
	debounce,
	createMockApp,
	createMockFile,
};

export function createMockSettingsStore(
	initialSettings?: Partial<CustomCalendarSettings>
): BehaviorSubject<CustomCalendarSettings> {
	const defaultSettings = CustomCalendarSettingsSchema.parse({});
	const settings = { ...defaultSettings, ...initialSettings };
	return new BehaviorSubject<CustomCalendarSettings>(settings);
}

// Create a mock single calendar config for testing individual calendar settings
export function createMockSingleCalendarSettings() {
	const fullSettings = CustomCalendarSettingsSchema.parse({});
	return fullSettings.calendars[0]; // Return the default calendar
}

// Create a mock settings store that returns single calendar settings (for legacy test compatibility)
export function createMockSingleCalendarSettingsStore(
	calendarOverrides?: any
): BehaviorSubject<any> {
	const singleCalendarSettings = createMockSingleCalendarSettings();
	const settings = { ...singleCalendarSettings, ...calendarOverrides };
	return new BehaviorSubject(settings);
}

// Setup DOM environment for FullCalendar tests
beforeEach(() => {
	// Clear any existing DOM elements
	document.body.innerHTML = "";

	// Add any global test setup here
});
