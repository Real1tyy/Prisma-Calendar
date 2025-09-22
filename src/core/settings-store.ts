import { SettingsStore as GenericSettingsStore } from "@real1ty-obsidian-plugins/utils/settings-store";
import type { Plugin } from "obsidian";
import { BehaviorSubject, type Subscription } from "rxjs";
import { CustomCalendarSettingsSchema, getCalendarById, type SingleCalendarConfig } from "../types/index";

export class SettingsStore extends GenericSettingsStore<typeof CustomCalendarSettingsSchema> {
	constructor(plugin: Plugin) {
		super(plugin, CustomCalendarSettingsSchema);
	}
}

export class CalendarSettingsStore {
	private subscription: Subscription | null = null;
	public readonly settings$: BehaviorSubject<SingleCalendarConfig>;
	public currentSettings: SingleCalendarConfig;

	constructor(
		private mainSettingsStore: SettingsStore,
		public readonly calendarId: string
	) {
		const initialSettings = getCalendarById(mainSettingsStore.currentSettings, calendarId);
		if (!initialSettings) {
			throw new Error(`Calendar with id ${calendarId} not found`);
		}
		this.currentSettings = initialSettings;
		this.settings$ = new BehaviorSubject(this.currentSettings);

		this.subscription = mainSettingsStore.settings$.subscribe((fullSettings) => {
			const newCalendarSettings = getCalendarById(fullSettings, this.calendarId);
			if (newCalendarSettings) {
				if (JSON.stringify(this.currentSettings) !== JSON.stringify(newCalendarSettings)) {
					this.currentSettings = newCalendarSettings;
					this.settings$.next(this.currentSettings);
				}
			} else {
				// The Calendar was deleted
			}
		});
	}

	async updateSettings(updater: (settings: SingleCalendarConfig) => SingleCalendarConfig): Promise<void> {
		const newSettings = updater(this.currentSettings);
		await this.mainSettingsStore.updateSettings((fullSettings) => {
			return {
				...fullSettings,
				calendars: fullSettings.calendars.map((calendar) => (calendar.id === this.calendarId ? newSettings : calendar)),
			};
		});
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.settings$.complete();
	}
}
