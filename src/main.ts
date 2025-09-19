import { onceAsync } from "@real1ty-obsidian-plugins/utils/async-utils";
import { Plugin } from "obsidian";
import { CalendarView, CustomCalendarSettingsTab } from "./components";
import { CalendarBundle, SettingsStore } from "./core";
import { createDefaultCalendarConfig } from "./types";

export default class CustomCalendarPlugin extends Plugin {
	settingsStore!: SettingsStore;
	calendarBundles: CalendarBundle[] = [];
	private registeredViewTypes: Set<string> = new Set();

	async onload() {
		this.settingsStore = new SettingsStore(this);
		await this.settingsStore.loadSettings();

		await this.ensureMinimumCalendars();

		this.initializeCalendarBundles();
		this.addSettingTab(new CustomCalendarSettingsTab(this.app, this));

		this.addCommand({
			id: "toggle-batch-selection",
			name: "Toggle Batch Selection",
			callback: () => {
				const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
				if (calendarView) {
					calendarView.toggleBatchSelection();
				}
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.ensureCalendarBundlesReady();
		});
	}

	async onunload() {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];
		this.registeredViewTypes.clear();
	}

	private initializeCalendarBundles(): void {
		const settings = this.settingsStore.currentSettings;

		for (const calendarConfig of settings.calendars) {
			if (calendarConfig.enabled) {
				const bundle = new CalendarBundle(this, calendarConfig.id, this.settingsStore);
				this.calendarBundles.push(bundle);
			}
		}
	}

	async ensureCalendarBundlesReady(): Promise<void> {
		return await onceAsync(async () => {
			for (const bundle of this.calendarBundles) {
				await bundle.initialize();
			}
		})();
	}

	private async ensureMinimumCalendars(): Promise<void> {
		const settings = this.settingsStore.currentSettings;

		if (!settings.calendars || settings.calendars.length === 0) {
			const defaultCalendar = createDefaultCalendarConfig("default", "Main Calendar");

			await this.settingsStore.updateSettings((currentSettings) => ({
				...currentSettings,
				calendars: [defaultCalendar],
			}));

			console.info("Created default calendar as none existed");
		}
	}

	async refreshCalendarBundles(): Promise<void> {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];

		this.initializeCalendarBundles();
		await this.ensureCalendarBundlesReady();
	}

	registerViewTypeSafe(viewType: string, viewCreator: (leaf: any) => any): boolean {
		if (this.registeredViewTypes.has(viewType)) {
			return false;
		}
		this.registerView(viewType, viewCreator);
		this.registeredViewTypes.add(viewType);
		return true;
	}
}
