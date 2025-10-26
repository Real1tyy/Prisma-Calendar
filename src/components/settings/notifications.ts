import { SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils/settings-ui-builder";
import { Setting } from "obsidian";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfigSchema } from "../../types/settings";

export class NotificationsSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as any);
	}

	display(containerEl: HTMLElement): void {
		this.addNotificationSettings(containerEl);
	}

	private addNotificationSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Notifications").setHeading();

		this.ui.addToggle(containerEl, {
			key: "enableNotifications",
			name: "Enable notifications",
			desc: "Enable event notifications. When disabled, all notification settings below are ignored.",
		});

		new Setting(containerEl).setName("Normal events").setHeading();

		this.ui.addText(containerEl, {
			key: "defaultMinutesBefore",
			name: "Default minutes before",
			desc: "Default notification time for normal events (with start and end dates). Leave empty for no default notification. 0 = notify when event starts, 15 = notify 15 minutes before.",
			placeholder: "e.g., 15 (leave empty for no default)",
		});

		this.ui.addText(containerEl, {
			key: "minutesBeforeProp",
			name: "Minutes before property",
			desc: "Frontmatter property name to read per-event notification times. This allows individual events to override the default notification time.",
			placeholder: "minutesBefore",
		});
	}
}
