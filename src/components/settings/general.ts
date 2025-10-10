import { normalizePath, Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";

export class GeneralSettings {
	constructor(private settingsStore: CalendarSettingsStore) {}

	display(containerEl: HTMLElement): void {
		this.addDirectorySettings(containerEl);
		this.addParsingSettings(containerEl);
	}

	private addDirectorySettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Calendar directory").setHeading();

		new Setting(containerEl)
			.setName("Directory")
			.setDesc("Folder to scan for calendar events and create new events in")
			.addText((text) => {
				text.setValue(settings.directory);
				text.setPlaceholder("e.g., tasks, calendar, events");
				text.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						directory: normalizePath(value),
					}));
				});
			});

		new Setting(containerEl)
			.setName("Template path")
			.setDesc("Path to Templater template file for new events (optional, requires Templater plugin)")
			.addText((text) => {
				text.setValue(settings.templatePath || "");
				text.setPlaceholder("e.g., Templates/event-template.md");
				text.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						templatePath: value ? normalizePath(value) : undefined,
					}));
				});
			});
	}

	private addParsingSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Parsing").setHeading();

		new Setting(containerEl)
			.setName("Default duration (minutes)")
			.setDesc("Default event duration when only start time is provided")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_DURATION_MINUTES.toString())
					.setValue(settings.defaultDurationMinutes.toString())
					.onChange(async (value) => {
						const duration = parseInt(value, 10);
						if (!Number.isNaN(duration) && duration > 0) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								defaultDurationMinutes: duration,
							}));
						}
					})
			);

		new Setting(containerEl)
			.setName("Mark past events as done")
			.setDesc(
				"Automatically mark past events as done during startup by updating their status property. Configure the status property and done value in the Properties section."
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.markPastInstancesAsDone).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						markPastInstancesAsDone: value,
					}));
				})
			);
	}
}
