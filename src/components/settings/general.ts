import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils";
import { type App, Setting } from "obsidian";
import type { Subscription } from "rxjs";
import { COMMAND_IDS, SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore, SettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfigSchema } from "../../types/settings";
import { CalDAVSettings } from "./caldav";

export class GeneralSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;
	private settingsSubscription: Subscription | null = null;
	private defaultPresetDropdown: HTMLSelectElement | null = null;
	private presetsListContainer: HTMLElement | null = null;

	constructor(
		private settingsStore: CalendarSettingsStore,
		private app: App,
		private plugin: CustomCalendarPlugin,
		private mainSettingsStore: SettingsStore
	) {
		this.ui = new SettingsUIBuilder(this.settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.defaultPresetDropdown = null;
		this.presetsListContainer = null;

		this.addDirectorySettings(containerEl);
		this.addParsingSettings(containerEl);
		this.addEventPresetSettings(containerEl);
		this.addIntegrationsSettings(containerEl);
		this.addCalDAVSettings(containerEl);
	}

	private addDirectorySettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Calendar directory").setHeading();

		this.ui.addText(containerEl, {
			key: "directory",
			name: "Directory",
			desc: "Folder to scan for calendar events and create new events in",
			placeholder: "e.g., tasks, calendar, events",
		});

		this.ui.addText(containerEl, {
			key: "templatePath",
			name: "Template path",
			desc: "Path to Templater template file for new events (optional, requires Templater plugin)",
			placeholder: "e.g., Templates/event-template.md",
		});

		this.ui.addToggle(containerEl, {
			key: "showRibbonIcon",
			name: "Show ribbon icon",
			desc: "Display a calendar icon in the left sidebar to quickly open this calendar",
		});

		this.ui.addToggle(containerEl, {
			key: "enableKeyboardNavigation",
			name: "Enable keyboard navigation",
			desc: "Use left/right arrow keys to navigate between calendar intervals. Automatically disabled when search or expression filter inputs are focused.",
		});
	}

	private addParsingSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Parsing").setHeading();

		this.ui.addSlider(containerEl, {
			key: "defaultDurationMinutes",
			name: "Default duration (minutes)",
			desc: "Default event duration when only start time is provided",
			min: 1,
			max: 240,
			step: 1,
		});

		this.ui.addToggle(containerEl, {
			key: "showDurationField",
			name: "Show duration field in event modal",
			desc: "Display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa.",
		});

		this.ui.addToggle(containerEl, {
			key: "showStopwatch",
			name: "Show time tracker in event modal",
			desc: "Display a stopwatch in the event creation/edit modal for precise time tracking. Start fills the start date, stop fills the end date, and break time is tracked automatically.",
		});

		this.ui.addToggle(containerEl, {
			key: "markPastInstancesAsDone",
			name: "Mark past events as done",
			desc: "Automatically mark past events as done during startup by updating their status property. Configure the status property and done value in the Properties section.",
		});

		this.ui.addToggle(containerEl, {
			key: "showDecimalHours",
			name: "Show decimal hours in statistics",
			desc: "Display durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m) in statistics modals. Can be temporarily toggled by clicking the duration in the statistics header.",
		});

		this.ui.addDropdown(containerEl, {
			key: "defaultAggregationMode",
			name: "Default statistics grouping",
			desc: "Default grouping mode for statistics modals: group by event name or by category",
			options: {
				name: "Event Name",
				category: "Category",
			},
		});
	}

	private addEventPresetSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Event presets").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Create presets with pre-configured event settings (duration, category, recurring pattern, etc.) for quick event creation. Select a preset from the dropdown when creating an event to auto-fill the form.",
		});

		// Examples section
		const examplesContainer = desc.createDiv(cls("settings-info-box"));

		examplesContainer.createEl("strong", { text: "Example presets:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			{ name: "30 min meeting", description: "Duration: 30 minutes" },
			{ name: "1 hour focus block", description: "Duration: 60 minutes, Category: Focus" },
			{ name: "Daily standup", description: "Duration: 15 min, Recurring: daily" },
			{ name: "All-day event", description: "All-day: enabled" },
		];

		for (const example of examples) {
			const li = examplesList.createEl("li", { cls: cls("color-example-item") });
			li.createEl("strong", { text: example.name });
			li.createSpan({ text: ` — ${example.description}` });
		}

		desc.createEl("p", {
			text: "Create and edit presets from the event modal. Here you can select a default preset and delete existing ones.",
			cls: cls("settings-muted"),
		});

		// Default preset selector
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

		// Presets list
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

		for (const preset of eventPresets) {
			const presetContainer = container.createDiv(cls("event-preset-item"));

			// Name
			const nameEl = presetContainer.createDiv(cls("event-preset-name"));
			nameEl.textContent = preset.name;

			// Details (tags showing what's configured)
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

			// Controls - only delete button
			const controlsEl = presetContainer.createDiv(cls("event-preset-controls"));

			const deleteButton = controlsEl.createEl("button", {
				text: "Delete",
				cls: `${cls("event-preset-btn")} ${cls("event-preset-btn-delete")}`,
			});
			deleteButton.onclick = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					eventPresets: (s.eventPresets || []).filter((p) => p.id !== preset.id),
					// Clear default preset if it was deleted
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

	private addIntegrationsSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Integrations").setHeading();

		const descContainer = containerEl.createDiv(cls("settings-integrations-desc"));

		descContainer
			.createEl("p")
			.setText("Export and import events using the .ics format, compatible with most calendar apps.");

		descContainer
			.createEl("a", {
				href: "https://real1tyy.github.io/Prisma-Calendar/docs/features/integrations",
				cls: cls("settings-docs-link"),
				attr: { target: "_blank" },
			})
			.setText("Documentation");

		this.ui.addText(containerEl, {
			key: "exportFolder",
			name: "Export folder",
			desc: "Folder where exported .ics files are saved",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_EXPORT_FOLDER,
		});

		const buttonsContainer = containerEl.createDiv(cls("settings-integrations-buttons"));

		const exportButton = buttonsContainer.createEl("button", {
			cls: cls("settings-integration-button"),
		});
		exportButton.setText("Export calendar");
		exportButton.addEventListener("click", () => {
			(this.app as unknown as { commands: { executeCommandById: (id: string) => void } }).commands.executeCommandById(
				`prisma-calendar:${COMMAND_IDS.EXPORT_CALENDAR_ICS}`
			);
		});

		const importButton = buttonsContainer.createEl("button", {
			cls: cls("settings-integration-button"),
		});
		importButton.setText("Import .ics");
		importButton.addEventListener("click", () => {
			(this.app as unknown as { commands: { executeCommandById: (id: string) => void } }).commands.executeCommandById(
				`prisma-calendar:${COMMAND_IDS.IMPORT_CALENDAR_ICS}`
			);
		});
	}

	private addCalDAVSettings(containerEl: HTMLElement): void {
		const calendarId = this.settingsStore.calendarId;
		const caldavSettings = new CalDAVSettings(this.app, this.mainSettingsStore, this.plugin, calendarId);
		caldavSettings.display(containerEl);
	}
}
