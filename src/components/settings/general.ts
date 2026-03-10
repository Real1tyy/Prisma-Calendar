import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { LOCALE_OPTIONS } from "../../types/view";
import { type App, SecretComponent, Setting } from "obsidian";
import type { Subscription } from "rxjs";
import { FREE_MAX_EVENT_PRESETS, PRO_PURCHASE_URL } from "../../core/license";
import type { LicenseStatus } from "../../types/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfigSchema } from "../../types/settings";
import { renderProUpgradeBanner } from "./pro-upgrade-banner";

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
		new Setting(containerEl).setName("License").setHeading();

		const desc = document.createDocumentFragment();
		desc.appendText("Enter your Prisma Calendar Pro license key to unlock advanced features. ");
		const link = desc.createEl("a", { text: "Get a license", href: PRO_PURCHASE_URL });
		link.setAttr("target", "_blank");
		link.setAttr("rel", "noopener noreferrer");

		new Setting(containerEl)
			.setName("License key")
			.setDesc(desc)
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(this.plugin.settingsStore.currentSettings.licenseKeySecretName)
					.onChange(async (value) => {
						await this.plugin.settingsStore.updateSettings((s) => ({
							...s,
							licenseKeySecretName: value,
						}));
					})
			);

		const statusSetting = new Setting(containerEl).setName("License status");
		this.refreshLicenseStatusDesc(statusSetting);

		statusSetting.addButton((button) =>
			button
				.setButtonText("Verify")
				.setCta()
				.onClick(async () => {
					try {
						button.setDisabled(true);
						button.setButtonText("Verifying...");
						await this.plugin.licenseManager.refreshLicense();
					} catch (error) {
						console.error("[Settings] License verification failed:", error);
					} finally {
						this.refreshLicenseStatusDesc(statusSetting);
						button.setButtonText("Verify");
						button.setDisabled(false);
					}
				})
		);
	}

	private refreshLicenseStatusDesc(setting: Setting): void {
		const status = this.plugin.licenseManager.getStatus();
		const fragment = document.createDocumentFragment();
		fragment.appendText(this.getLicenseStatusText(status));
		if (status.state === "valid") {
			const badge = fragment.createSpan({ cls: cls("license-activations-badge") });
			badge.textContent = `${status.activationsCurrent}/${status.activationsLimit} devices`;
		}
		setting.setDesc(fragment);
	}

	private getLicenseStatusText(status: LicenseStatus): string {
		if (status.state === "none") return "No license key configured";
		if (status.state === "valid") {
			if (status.expiresAt) {
				const expiryDate = new Date(status.expiresAt).toLocaleDateString(undefined, {
					year: "numeric",
					month: "long",
					day: "numeric",
				});
				return `License active — valid offline until ${expiryDate}`;
			}
			return "License active";
		}
		if (status.state === "expired") return "License expired. Click Verify to refresh.";
		if (status.state === "invalid") return status.errorMessage ?? "Invalid license key.";
		if (status.state === "device_limit") return status.errorMessage ?? "Device limit reached.";
		if (status.state === "error") return status.errorMessage ?? "Could not verify license.";
		return "";
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

		this.ui.addDropdown(containerEl, {
			key: "locale",
			name: "Locale",
			desc: "Language and date format for calendar headings, day names, month names, toolbar labels, and date displays",
			options: LOCALE_OPTIONS,
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

		this.ui.addDropdown(containerEl, {
			key: "autoAssignZettelId",
			name: "Auto-assign Zettel ID",
			desc: "Automatically add a Zettel ID timestamp to filenames of events in the calendar directory that don't have one. Files are renamed from 'My Event.md' to 'My Event-20260216120000.md'.",
			options: {
				disabled: "Disabled",
				calendarEvents: "Calendar events only",
				allEvents: "All events",
			},
		});

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
			key: "markPastInstancesAsDone",
			name: "Mark past events as done",
			desc: "Automatically mark past events as done during startup by updating their status property. Configure the status property and done value in the Properties section.",
		});

		this.ui.addToggle(containerEl, {
			key: "titleAutocomplete",
			name: "Title autocomplete",
			desc: "Show inline type-ahead suggestions when typing event titles in the create/edit modal. Suggests categories, event presets, and frequently used event names.",
		});
	}

	private addStopwatchSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Time tracker").setHeading();

		this.ui.addToggle(containerEl, {
			key: "showStopwatch",
			name: "Show time tracker in event modal",
			desc: "Display a stopwatch in the event creation/edit modal for precise time tracking. Start fills the start date, stop fills the end date, and break time is tracked automatically.",
		});

		this.ui.addToggle(containerEl, {
			key: "showStopwatchStartWithoutFill",
			name: "Show 'continue' button",
			desc: "Display a continue button that resumes time tracking from the existing start date. The timer calculates elapsed time based on the event's start time and continues from there, perfect for resuming work on existing events.",
		});
	}

	private addStatisticsSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Statistics").setHeading();

		this.ui.addToggle(containerEl, {
			key: "showDecimalHours",
			name: "Show decimal hours",
			desc: "Display durations as decimal hours (e.g., 2.5h) instead of formatted (e.g., 2h 30m) in statistics modals. Can be temporarily toggled by clicking the duration in the statistics header.",
		});

		this.ui.addDropdown(containerEl, {
			key: "defaultAggregationMode",
			name: "Default grouping mode",
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

		if (!this.plugin.isProEnabled && eventPresets.length >= FREE_MAX_EVENT_PRESETS) {
			renderProUpgradeBanner(
				container,
				"Unlimited Event Presets",
				`Free plan supports up to ${FREE_MAX_EVENT_PRESETS} event presets. Upgrade to Pro for unlimited presets.`
			);
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
}
