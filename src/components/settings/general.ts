import { cls, renderLicenseSettings, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { type App, Setting } from "obsidian";
import type { Subscription } from "rxjs";

import { FREE_MAX_EVENT_PRESETS } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { LOCALE_OPTIONS } from "../../types/view";
import { renderProUpgradeBanner } from "./pro-upgrade-banner";

const S = SingleCalendarConfigSchema.shape;

export class GeneralSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;
	private settingsSubscription: Subscription | null = null;
	private defaultPresetDropdown: HTMLSelectElement | null = null;
	private presetsListContainer: HTMLElement | null = null;

	constructor(
		private settingsStore: CalendarSettingsStore,
		private app: App,
		private plugin: CustomCalendarPlugin
	) {
		this.ui = new SettingsUIBuilder(this.settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.defaultPresetDropdown = null;
		this.presetsListContainer = null;

		this.addLicenseSettings(containerEl);
		this.addDirectorySettings(containerEl);
		this.addParsingSettings(containerEl);
		this.addStopwatchSettings(containerEl);
		this.addStatisticsSettings(containerEl);
		this.addEventPresetSettings(containerEl);
	}

	private addLicenseSettings(containerEl: HTMLElement): void {
		renderLicenseSettings(containerEl, {
			app: this.app,
			licenseManager: this.plugin.licenseManager,
			currentSecretName: this.plugin.settingsStore.currentSettings.licenseKeySecretName,
			cssPrefix: "prisma-",
			onSecretChange: async (value) => {
				await this.plugin.settingsStore.updateSettings((s) => ({
					...s,
					licenseKeySecretName: value,
				}));
			},
		});
	}

	private addDirectorySettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Calendar directory").setHeading();

		this.ui.addSchemaField(containerEl, { directory: S.directory }, { placeholder: "e.g., tasks, calendar, events" });
		this.ui.addSchemaField(
			containerEl,
			{ templatePath: S.templatePath },
			{ placeholder: "e.g., Templates/event-template.md" }
		);
		this.ui.addSchemaField(containerEl, { locale: S.locale }, { options: LOCALE_OPTIONS });
		this.ui.addSchemaField(containerEl, { showRibbonIcon: S.showRibbonIcon });
		this.ui.addSchemaField(containerEl, { enableKeyboardNavigation: S.enableKeyboardNavigation });

		this.ui.addSchemaField(
			containerEl,
			{ autoAssignZettelId: S.autoAssignZettelId },
			{
				options: {
					disabled: "Disabled",
					calendarEvents: "Calendar events only",
					allEvents: "All events",
				},
			}
		);

		new Setting(containerEl)
			.setName("Read-only mode")
			.setDesc(
				"Prevent automatic file modifications. When enabled, the plugin will not automatically write to files (notifications, recurring event generation). Manual actions like propagation will still work. Stored in sync.json to prevent syncing across devices."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.syncStore.data.readOnly).onChange(async (value) => {
					await this.plugin.syncStore.updateData({ readOnly: value });
				});
			});
	}

	private addParsingSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Parsing").setHeading();

		this.ui.addSchemaField(
			containerEl,
			{ defaultDurationMinutes: S.defaultDurationMinutes },
			{ name: "Default duration (minutes)" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ showDurationField: S.showDurationField },
			{ name: "Show duration field in event modal" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ markPastInstancesAsDone: S.markPastInstancesAsDone },
			{ name: "Mark past events as done" }
		);
		this.ui.addSchemaField(containerEl, { titleAutocomplete: S.titleAutocomplete });
	}

	private addStopwatchSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Time tracker").setHeading();

		this.ui.addSchemaField(
			containerEl,
			{ showStopwatch: S.showStopwatch },
			{ name: "Show time tracker in event modal" }
		);
	}

	private addStatisticsSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Statistics").setHeading();

		this.ui.addSchemaField(containerEl, { showDecimalHours: S.showDecimalHours });
		this.ui.addSchemaField(
			containerEl,
			{ defaultAggregationMode: S.defaultAggregationMode },
			{
				name: "Default grouping mode",
				options: {
					name: "Event Name",
					category: "Category",
				},
			}
		);
	}

	private addEventPresetSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Event presets").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Create presets with pre-configured event settings (duration, category, recurring pattern, etc.) for quick event creation. Select a preset from the dropdown when creating an event to auto-fill the form.",
		});

		const examplesContainer = desc.createDiv(cls("settings-info-box"));

		examplesContainer.createEl("strong", { text: "Example presets:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			{ name: "30 min meeting", description: "Duration: 30 minutes" },
			{
				name: "1 hour focus block",
				description: "Duration: 60 minutes, Category: Focus",
			},
			{
				name: "Daily standup",
				description: "Duration: 15 min, Recurring: daily",
			},
			{ name: "All-day event", description: "All-day: enabled" },
		];

		for (const example of examples) {
			const li = examplesList.createEl("li", {
				cls: cls("color-example-item"),
			});
			li.createEl("strong", { text: example.name });
			li.createSpan({ text: ` — ${example.description}` });
		}

		desc.createEl("p", {
			text: "Create and edit presets from the event modal. Here you can select a default preset and delete existing ones.",
			cls: cls("settings-muted"),
		});

		new Setting(containerEl)
			.setName("Default preset")
			.setDesc("Preset to auto-fill when opening the create event modal")
			.addDropdown((dropdown) => {
				this.defaultPresetDropdown = dropdown.selectEl;
				this.refreshDefaultPresetDropdown();

				dropdown.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						defaultPresetId: value || undefined,
					}));
				});
			});

		this.presetsListContainer = containerEl.createDiv();
		this.renderEventPresetsList(this.presetsListContainer);

		this.settingsSubscription = this.settingsStore.settings$.subscribe(() => {
			if (this.presetsListContainer) {
				this.renderEventPresetsList(this.presetsListContainer);
			}
			this.refreshDefaultPresetDropdown();
		});
	}

	private refreshDefaultPresetDropdown(): void {
		if (!this.defaultPresetDropdown) return;

		const settings = this.settingsStore.currentSettings;
		const currentValue = this.defaultPresetDropdown.value;

		while (this.defaultPresetDropdown.options.length > 0) {
			this.defaultPresetDropdown.remove(0);
		}

		const noneOption = document.createElement("option");
		noneOption.value = "";
		noneOption.textContent = "None";
		this.defaultPresetDropdown.appendChild(noneOption);

		const presets = settings.eventPresets || [];
		for (const preset of presets) {
			const option = document.createElement("option");
			option.value = preset.id;
			option.textContent = preset.name;
			this.defaultPresetDropdown.appendChild(option);
		}

		if (currentValue && presets.some((p) => p.id === currentValue)) {
			this.defaultPresetDropdown.value = currentValue;
		} else {
			this.defaultPresetDropdown.value = settings.defaultPresetId || "";
		}
	}

	private renderEventPresetsList(container: HTMLElement): void {
		container.empty();
		const { eventPresets } = this.settingsStore.currentSettings;

		if (!eventPresets || eventPresets.length === 0) {
			const emptyState = container.createDiv(cls("event-preset-empty"));
			emptyState.textContent = "No event presets defined. Create presets from the event modal.";
			return;
		}

		if (!this.plugin.isProEnabled && eventPresets.length >= FREE_MAX_EVENT_PRESETS) {
			renderProUpgradeBanner(
				container,
				"Unlimited Event Presets",
				`Free plan supports up to ${FREE_MAX_EVENT_PRESETS} event presets. Upgrade to Pro for unlimited presets.`
			);
		}

		for (const preset of eventPresets) {
			const presetContainer = container.createDiv(cls("event-preset-item"));

			const nameEl = presetContainer.createDiv(cls("event-preset-name"));
			nameEl.textContent = preset.name;

			const detailsEl = presetContainer.createDiv(cls("event-preset-details"));

			if (preset.allDay !== undefined) {
				this.createPresetTag(detailsEl, preset.allDay ? "All-day" : "Timed");
			}

			if (preset.categories) {
				this.createPresetTag(detailsEl, preset.categories);
			}

			if (preset.rruleType) {
				this.createPresetTag(detailsEl, preset.rruleType);
			}

			if (preset.futureInstancesCount) {
				this.createPresetTag(detailsEl, `${preset.futureInstancesCount} instances`);
			}

			const customPropsCount = Object.keys(preset.customProperties ?? {}).length;
			if (customPropsCount > 0) {
				this.createPresetTag(detailsEl, `${customPropsCount} props`);
			}

			const controlsEl = presetContainer.createDiv(cls("event-preset-controls"));

			const deleteButton = controlsEl.createEl("button", {
				text: "Delete",
				cls: `${cls("event-preset-btn")} ${cls("event-preset-btn-delete")}`,
			});
			deleteButton.onclick = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					eventPresets: (s.eventPresets || []).filter((p) => p.id !== preset.id),
					defaultPresetId: s.defaultPresetId === preset.id ? undefined : s.defaultPresetId,
				}));
			};
		}
	}

	private createPresetTag(container: HTMLElement, text: string): void {
		container.createEl("span", {
			text,
			cls: cls("event-preset-tag"),
		});
	}
}
