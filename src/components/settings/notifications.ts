import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfig } from "../../types/settings";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

export class NotificationsSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(private settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.addNotificationSettings(containerEl);
	}

	private addNotificationSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Notifications").setHeading();

		this.ui.addSchemaField(containerEl, { enableNotifications: S.enableNotifications });
		this.ui.addSchemaField(
			containerEl,
			{ notificationSound: S.notificationSound },
			{ name: "Play notification sound" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ skipNewlyCreatedNotifications: S.skipNewlyCreatedNotifications },
			{ name: "Skip newly created events" }
		);
		this.ui.addSchemaField(containerEl, { snoozeMinutes: S.snoozeMinutes }, { name: "Snooze duration (minutes)" });

		new Setting(containerEl).setName("Default notification times").setHeading();

		this.addOptionalNumberInput(
			containerEl,
			"defaultMinutesBefore",
			"Timed events (minutes before)",
			"Default notification time for timed events. Leave empty for no default. 0 = notify when event starts, 15 = notify 15 minutes before",
			"e.g., 15 (leave empty for no default)"
		);

		this.addOptionalNumberInput(
			containerEl,
			"defaultDaysBefore",
			"All-day events (days before)",
			"Default notification time for all-day events. Leave empty for no default. 0 = notify on the day of the event, 1 = notify 1 day before",
			"e.g., 1 (leave empty for no default)"
		);
	}

	private addOptionalNumberInput(
		containerEl: HTMLElement,
		key: keyof SingleCalendarConfig,
		name: string,
		desc: string,
		placeholder: string
	): void {
		const settings = this.settingsStore.currentSettings;
		const currentValue = settings[key] as number | undefined;

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text.setPlaceholder(placeholder);
				text.setValue(currentValue !== undefined ? String(currentValue) : "");

				text.inputEl.addEventListener("blur", () => {
					void (async () => {
						const inputValue = text.inputEl.value.trim();

						if (inputValue === "") {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								[key]: undefined,
							}));
						} else {
							const numValue = Number(inputValue);
							if (!Number.isNaN(numValue) && Number.isInteger(numValue) && numValue >= 0) {
								await this.settingsStore.updateSettings((s) => ({
									...s,
									[key]: numValue,
								}));
							}
						}
					})();
				});

				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						text.inputEl.blur();
					}
				});
			});
	}
}
