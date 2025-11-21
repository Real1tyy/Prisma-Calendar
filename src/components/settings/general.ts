import { SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils";
import { Setting } from "obsidian";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfigSchema } from "../../types/settings";

export class GeneralSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as any);
	}

	display(containerEl: HTMLElement): void {
		this.addDirectorySettings(containerEl);
		this.addParsingSettings(containerEl);
	}

	private addDirectorySettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Calendar directory").setHeading();

		this.ui.addText(containerEl, {
			key: "directory",
			name: "Directory",
			desc: "Folder to scan for calendar events and create new events in",
			placeholder: "e.g., tasks, calendar, events",
		});

		this.ui.addText(containerEl, {
			key: "templatePath",
			name: "Template path",
			desc: "Path to Templater template file for new events (optional, requires Templater plugin)",
			placeholder: "e.g., Templates/event-template.md",
		});
	}

	private addParsingSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Parsing").setHeading();

		this.ui.addSlider(containerEl, {
			key: "defaultDurationMinutes",
			name: "Default duration (minutes)",
			desc: "Default event duration when only start time is provided",
			min: 1,
			max: 240,
			step: 1,
		});

		this.ui.addToggle(containerEl, {
			key: "showDurationField",
			name: "Show duration field in event modal",
			desc: "Display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa.",
		});

		this.ui.addToggle(containerEl, {
			key: "markPastInstancesAsDone",
			name: "Mark past events as done",
			desc: "Automatically mark past events as done during startup by updating their status property. Configure the status property and done value in the Properties section.",
		});
	}
}
