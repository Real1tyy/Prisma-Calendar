import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfigSchema } from "../../types/settings";

export class BasesSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Bases").setHeading();

		this.ui.addDropdown(containerEl, {
			key: "basesViewType",
			name: "View type",
			desc: "Choose the default view type for Bases views (category events, interval views). Cards view displays events as visual cards, table view as a sortable table, and list view as a simple list.",
			options: {
				cards: "Cards (Recommended)",
				table: "Table",
				list: "List",
			},
		});

		this.ui.addTextArray(containerEl, {
			key: "basesViewProperties",
			name: "Additional properties",
			desc: "Comma-separated list of frontmatter properties to include as columns in Bases views. These properties will appear after the default columns (file name, date, status).",
			placeholder: "priority, project, tags",
			arrayDelimiter: ", ",
		});
	}
}
