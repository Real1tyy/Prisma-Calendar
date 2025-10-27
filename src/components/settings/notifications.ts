import { SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils/settings-ui-builder";
import { Setting } from "obsidian";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfig, SingleCalendarConfigSchema } from "../../types/settings";

export class NotificationsSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(private settingsStore: CalendarSettingsStore) {
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

		new Setting(containerEl).setName("Timed events").setHeading();

		this.addOptionalNumberInput(
			containerEl,
			"defaultMinutesBefore",
			"Default minutes before",
			"Default notification time for timed events (with start and end dates). Leave empty for no default notification. 0 = notify when event starts, 15 = notify 15 minutes before.",
			"e.g., 15 (leave empty for no default)"
		);

		this.ui.addText(containerEl, {
			key: "minutesBeforeProp",
			name: "Minutes before property",
			desc: "Frontmatter property name to read per-event notification times. This allows individual events to override the default notification time.",
			placeholder: "Minutes Before",
		});

		new Setting(containerEl).setName("All-day events").setHeading();

		this.addOptionalNumberInput(
			containerEl,
			"defaultDaysBefore",
			"Default days before",
			"Default notification time for all-day events. Leave empty for no default notification. 0 = notify on the day of the event, 1 = notify 1 day before.",
			"e.g., 1 (leave empty for no default)"
		);

		this.ui.addText(containerEl, {
			key: "daysBeforeProp",
			name: "Days before property",
			desc: "Frontmatter property name to read per-event notification days for all-day events. This allows individual events to override the default notification days.",
			placeholder: "Days Before",
		});

		new Setting(containerEl).setName("General").setHeading();

		this.ui.addToggle(containerEl, {
			key: "notificationSound",
			name: "Play notification sound",
			desc: "Whether to play a system sound when notifications are shown. When disabled, notifications will be silent.",
		});

		this.ui.addText(containerEl, {
			key: "alreadyNotifiedProp",
			name: "Already notified property",
			desc: "Frontmatter property used to mark events as already notified. When a notification is shown, this property is set to true. Unmark it manually to get notified again.",
			placeholder: "Already Notified",
		});
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

				text.inputEl.addEventListener("blur", async () => {
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
