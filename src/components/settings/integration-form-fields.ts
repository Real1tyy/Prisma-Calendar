import { Setting } from "obsidian";

import { COMMON_TIMEZONES } from "../../core/integrations/ics-export";

export function renderSyncIntervalField(container: HTMLElement, value: number, onChange: (v: number) => void): void {
	new Setting(container)
		.setName("Sync interval (minutes)")
		.setDesc("How often to automatically sync (1-1440 minutes)")
		.addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = "1";
			text.inputEl.max = "1440";
			text.inputEl.step = "1";
			text.setValue(value.toString());
			text.onChange((raw) => {
				const numValue = parseInt(raw, 10);
				if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 1440) {
					onChange(numValue);
				}
			});
		});
}

export function renderTimezoneField(container: HTMLElement, value: string, onChange: (v: string) => void): void {
	new Setting(container)
		.setName("Timezone")
		.setDesc("Timezone for event times. If it matches your calendar events, times are preserved as-is.")
		.addDropdown((dropdown) => {
			for (const tz of COMMON_TIMEZONES) {
				dropdown.addOption(tz.id, tz.label);
			}
			dropdown.setValue(value);
			dropdown.onChange(onChange);
		});
}

export function renderIconField(container: HTMLElement, value: string, onChange: (v: string) => void): void {
	new Setting(container)
		.setName("Calendar icon")
		.setDesc("Optional icon/emoji to display on synced events (e.g., \u{1F4C5}, \u{1F504}, \u2601\uFE0F)")
		.addText((text) => {
			text.setPlaceholder("\u{1F4C5}").setValue(value).onChange(onChange);
		});
}
