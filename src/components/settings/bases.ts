import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

export class BasesSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Bases").setHeading();

		this.ui.addSchemaField(
			containerEl,
			{ basesViewType: S.basesViewType },
			{
				name: "View type",
				options: {
					cards: "Cards (Recommended)",
					table: "Table",
					list: "List",
				},
			}
		);

		this.ui.addSchemaField(
			containerEl,
			{ basesViewProperties: S.basesViewProperties },
			{ name: "Additional properties", placeholder: "priority, project, tags" }
		);
	}
}
