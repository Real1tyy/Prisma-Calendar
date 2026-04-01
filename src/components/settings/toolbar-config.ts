import { Setting } from "obsidian";

import { BATCH_BUTTON_IDS, BATCH_BUTTON_LABELS, TOOLBAR_BUTTON_IDS, TOOLBAR_BUTTON_LABELS } from "../../constants";
import type { CalendarSettingsStore, ToolbarButtonsKey } from "../../core/settings-store";

export class ConfigurationSettings {
	constructor(private settingsStore: CalendarSettingsStore) {}

	display(containerEl: HTMLElement): void {
		this.addDesktopToolbarSettings(containerEl);
		this.addMobileToolbarSettings(containerEl);
		this.addBatchSelectionSettings(containerEl);
	}

	private addDesktopToolbarSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Desktop toolbar buttons").setHeading();

		new Setting(containerEl)
			.setName("Desktop toolbar buttons")
			.setDesc(
				"Choose which buttons to display in the calendar toolbar on desktop. Uncheck items to hide them and save space in narrow sidebars. \u26A0\uFE0F Reopen the calendar view for changes to take effect."
			);

		this.renderToolbarButtonToggles(containerEl, "toolbarButtons");
	}

	private addMobileToolbarSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Mobile toolbar buttons").setHeading();

		new Setting(containerEl)
			.setName("Mobile toolbar buttons")
			.setDesc(
				"Choose which buttons to display in the calendar toolbar on mobile. Uncheck items to hide them and save space on smaller screens. \u26A0\uFE0F Reopen the calendar view for changes to take effect."
			);

		this.renderToolbarButtonToggles(containerEl, "mobileToolbarButtons");
	}

	private addBatchSelectionSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Batch selection").setHeading();

		new Setting(containerEl)
			.setName("Batch action buttons")
			.setDesc(
				"Choose which action buttons to display in batch selection mode toolbar. The counter and exit buttons are always shown."
			);

		const batchButtonsContainer = containerEl.createDiv({
			cls: "prisma-batch-buttons-container",
		});

		const currentButtons = new Set(this.settingsStore.currentSettings.batchActionButtons);

		for (const buttonId of BATCH_BUTTON_IDS) {
			const buttonSetting = new Setting(batchButtonsContainer)
				.setName(BATCH_BUTTON_LABELS[buttonId] || buttonId)
				.addToggle((toggle) => {
					toggle.setValue(currentButtons.has(buttonId)).onChange(async (value) => {
						const current = this.settingsStore.currentSettings.batchActionButtons;

						const updated = value
							? BATCH_BUTTON_IDS.filter((id) => current.includes(id) || id === buttonId)
							: current.filter((id) => id !== buttonId);

						await this.settingsStore.updateSettings((s) => ({
							...s,
							batchActionButtons: updated,
						}));
					});
				});

			buttonSetting.settingEl.addClass("prisma-batch-button-setting");
		}
	}

	private renderToolbarButtonToggles(containerEl: HTMLElement, key: ToolbarButtonsKey): void {
		const container = containerEl.createDiv({ cls: "prisma-batch-buttons-container" });
		const currentButtons = new Set(this.settingsStore.currentSettings[key]);

		for (const buttonId of TOOLBAR_BUTTON_IDS) {
			const buttonSetting = new Setting(container)
				.setName(TOOLBAR_BUTTON_LABELS[buttonId] || buttonId)
				.addToggle((toggle) => {
					toggle.setValue(currentButtons.has(buttonId)).onChange(async (value) => {
						await this.settingsStore.toggleToolbarButton(key, buttonId, value);
					});
				});

			buttonSetting.settingEl.addClass("prisma-batch-button-setting");
		}
	}
}
