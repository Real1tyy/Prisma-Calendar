import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

export class PerformanceSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Performance").setHeading();
		this.ui.addSchemaField(containerEl, { enableNameSeriesTracking: S.enableNameSeriesTracking });
		this.ui.addSchemaField(
			containerEl,
			{ fileConcurrencyLimit: S.fileConcurrencyLimit },
			{ name: "File operation concurrency limit" }
		);
	}
}
