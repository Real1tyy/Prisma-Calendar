import { Setting } from "obsidian";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";

export function renderNameField(
	container: HTMLElement,
	config: { value: string; label?: string; desc?: string; placeholder?: string; onChange: (value: string) => void }
): void {
	new Setting(container)
		.setName(config.label ?? "Name")
		.setDesc(config.desc ?? "Display name")
		.addText((text) => {
			text
				.setPlaceholder(config.placeholder ?? "My calendar")
				.setValue(config.value)
				.onChange(config.onChange);
		});
}

export function renderUrlField(
	container: HTMLElement,
	config: { value: string; label?: string; desc?: string; placeholder?: string; onChange: (value: string) => void }
): void {
	new Setting(container)
		.setName(config.label ?? "URL")
		.setDesc(config.desc ?? "Server URL")
		.addText((text) => {
			text
				.setPlaceholder(config.placeholder ?? "https://example.com")
				.setValue(config.value)
				.onChange(config.onChange);
		});
}

export function renderSyncIntervalField(
	container: HTMLElement,
	config: { value: number; onChange: (value: number) => void }
): void {
	new Setting(container)
		.setName("Sync interval (minutes)")
		.setDesc("How often to automatically sync (1-1440 minutes)")
		.addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = "1";
			text.inputEl.max = "1440";
			text.inputEl.step = "1";
			text.setValue(config.value.toString());
			text.onChange((value) => {
				const numValue = parseInt(value, 10);
				if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 1440) {
					config.onChange(numValue);
				}
			});
		});
}

export function renderTimezoneField(
	container: HTMLElement,
	config: { value: string; onChange: (value: string) => void }
): void {
	new Setting(container)
		.setName("Timezone")
		.setDesc("Timezone for event times. If it matches your calendar events, times are preserved as-is.")
		.addDropdown((dropdown) => {
			for (const tz of COMMON_TIMEZONES) {
				dropdown.addOption(tz.id, tz.label);
			}
			dropdown.setValue(config.value);
			dropdown.onChange(config.onChange);
		});
}

export function renderEnabledToggle(
	container: HTMLElement,
	config: { value: boolean; desc?: string; onChange: (value: boolean) => void }
): void {
	new Setting(container)
		.setName("Enabled")
		.setDesc(config.desc ?? "Enable or disable syncing")
		.addToggle((toggle) => {
			toggle.setValue(config.value).onChange(config.onChange);
		});
}

export function renderActionButtons(
	container: HTMLElement,
	config: { cancelFn: () => void; saveFn: () => void; saveText: string; isCta?: boolean }
): void {
	new Setting(container)
		.addButton((button) => {
			button.setButtonText("Cancel").onClick(config.cancelFn);
		})
		.addButton((button) => {
			button.setButtonText(config.saveText);
			if (config.isCta !== false) {
				button.setCta();
			}
			button.onClick(config.saveFn);
		});
}
