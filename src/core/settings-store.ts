import { arrayElementLens, ScopedSettingsStore } from "@real1ty/obsidian-plugins";

import { TOOLBAR_BUTTON_IDS } from "../constants";
import {
	SingleCalendarConfigSchema,
	type CustomCalendarSettings,
	type PrismaCalendarSettingsStore,
	type SingleCalendarConfig,
} from "../types/index";

export type ToolbarButtonsKey = "toolbarButtons" | "mobileToolbarButtons";

export class CalendarSettingsStore extends ScopedSettingsStore<CustomCalendarSettings, SingleCalendarConfig> {
	public readonly validationSchema = SingleCalendarConfigSchema;

	constructor(
		public readonly mainSettingsStore: PrismaCalendarSettingsStore,
		public readonly calendarId: string
	) {
		super(mainSettingsStore, arrayElementLens<CustomCalendarSettings, SingleCalendarConfig>("calendars", calendarId));
	}

	async toggleToolbarButton(key: ToolbarButtonsKey, buttonId: string, enabled: boolean): Promise<void> {
		const current = this.currentSettings[key];
		const updated = enabled
			? TOOLBAR_BUTTON_IDS.filter((id) => current.includes(id) || id === buttonId)
			: current.filter((id) => id !== buttonId);
		await this.updateSettings((s) => ({ ...s, [key]: updated }));
	}
}
