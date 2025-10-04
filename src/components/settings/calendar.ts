import { Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { CALENDAR_VIEW_OPTIONS, type CalendarViewType, DENSITY_OPTIONS, FIRST_DAY_OPTIONS } from "../../types/index";

export class CalendarSettings {
	constructor(private settingsStore: CalendarSettingsStore) {}

	display(containerEl: HTMLElement): void {
		this.addRecurringEventSettings(containerEl);
		this.addUISettings(containerEl);
	}

	private addRecurringEventSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Recurring events").setHeading();

		new Setting(containerEl)
			.setName("Future instances count")
			.setDesc("Maximum number of future recurring event instances to generate (1-52)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT.toString())
					.setValue(settings.futureInstancesCount.toString())
					.onChange(async (value) => {
						const count = parseInt(value, 10);
						if (!Number.isNaN(count) && count >= 1 && count <= 52) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								futureInstancesCount: count,
							}));
						}
					})
			);
	}

	private addUISettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("User interface").setHeading();

		new Setting(containerEl)
			.setName("Default view")
			.setDesc("The calendar view to show when opening")
			.addDropdown((dropdown) => {
				Object.entries(CALENDAR_VIEW_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(settings.defaultView).onChange(async (value: string) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						defaultView: value as CalendarViewType,
					}));
				});
			});

		new Setting(containerEl)
			.setName("Hide weekends")
			.setDesc("Hide Saturday and Sunday in calendar views")
			.addToggle((toggle) =>
				toggle.setValue(settings.hideWeekends).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, hideWeekends: value }));
				})
			);

		new Setting(containerEl)
			.setName("Enable event preview")
			.setDesc("Show preview of event notes when hovering over events in the calendar")
			.addToggle((toggle) =>
				toggle.setValue(settings.enableEventPreview).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, enableEventPreview: value }));
				})
			);

		new Setting(containerEl)
			.setName("Skip underscore properties")
			.setDesc("Hide frontmatter properties that start with underscore (e.g., _ZLID) in event previews and edit modals")
			.addToggle((toggle) =>
				toggle.setValue(settings.skipUnderscoreProperties).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, skipUnderscoreProperties: value }));
				})
			);

		new Setting(containerEl)
			.setName("Show current time indicator")
			.setDesc("Display a line showing the current time in weekly and daily calendar views")
			.addToggle((toggle) =>
				toggle.setValue(settings.nowIndicator).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, nowIndicator: value }));
				})
			);

		new Setting(containerEl)
			.setName("Past event contrast")
			.setDesc("Visual contrast of past events (0% = invisible, 100% = normal)")
			.addSlider((slider) => {
				slider
					.setLimits(0, 100, 1)
					.setValue(settings.pastEventContrast)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							pastEventContrast: value,
						}));
					});
			});

		new Setting(containerEl)
			.setName("First day of week")
			.setDesc("Which day should be the first day of the week in calendar views")
			.addDropdown((dropdown) => {
				Object.entries(FIRST_DAY_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(settings.firstDayOfWeek.toString()).onChange(async (value: string) => {
					const dayNumber = parseInt(value, 10);
					if (!Number.isNaN(dayNumber) && dayNumber >= 0 && dayNumber <= 6) {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							firstDayOfWeek: dayNumber,
						}));
					}
				});
			});

		new Setting(containerEl)
			.setName("Day start hour")
			.setDesc("First hour to show in time grid views")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_HOUR_START.toString())
					.setValue(settings.hourStart.toString())
					.onChange(async (value) => {
						const hour = parseInt(value, 10);
						if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
							await this.settingsStore.updateSettings((s) => ({ ...s, hourStart: hour }));
						}
					})
			);

		new Setting(containerEl)
			.setName("Day end hour")
			.setDesc("Last hour to show in time grid views")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_HOUR_END.toString())
					.setValue(settings.hourEnd.toString())
					.onChange(async (value) => {
						const hour = parseInt(value, 10);
						if (!Number.isNaN(hour) && hour >= 1 && hour <= 24) {
							await this.settingsStore.updateSettings((s) => ({ ...s, hourEnd: hour }));
						}
					})
			);

		new Setting(containerEl)
			.setName("Slot duration (minutes)")
			.setDesc("Duration of time slots in the calendar grid (1-60 minutes)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_SLOT_DURATION_MINUTES.toString())
					.setValue(settings.slotDurationMinutes.toString())
					.onChange(async (value) => {
						const duration = parseInt(value, 10);
						if (!Number.isNaN(duration) && duration >= 1 && duration <= 60) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								slotDurationMinutes: duration,
							}));
						}
					})
			);

		new Setting(containerEl)
			.setName("Snap duration (minutes)")
			.setDesc("Snap interval when dragging or resizing events (1-60 minutes)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_SNAP_DURATION_MINUTES.toString())
					.setValue(settings.snapDurationMinutes.toString())
					.onChange(async (value) => {
						const duration = parseInt(value, 10);
						if (!Number.isNaN(duration) && duration >= 1 && duration <= 60) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								snapDurationMinutes: duration,
							}));
						}
					})
			);

		new Setting(containerEl)
			.setName("Zoom levels (minutes)")
			.setDesc("Available zoom levels for CTRL+scroll zooming. Enter comma-separated values (1-60 minutes each)")
			.addTextArea((text) => {
				text.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_ZOOM_LEVELS.join(", "));
				text.setValue(settings.zoomLevels.join(", "));
				text.onChange(async (value) => {
					const levels = value
						.split(",")
						.map((level) => parseInt(level.trim(), 10))
						.filter((level) => !Number.isNaN(level) && level >= 1 && level <= 60)
						.sort((a, b) => a - b); // Sort ascending

					if (levels.length > 0) {
						await this.settingsStore.updateSettings((s) => ({ ...s, zoomLevels: levels }));
					}
				});
				text.inputEl.rows = 2;
			});

		new Setting(containerEl)
			.setName("Display density")
			.setDesc("How compact to make the calendar display")
			.addDropdown((dropdown) => {
				Object.entries(DENSITY_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(settings.density).onChange(async (value: string) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						density: value as "comfortable" | "compact",
					}));
				});
			});

		// Event overlap settings section
		new Setting(containerEl).setName("Event overlap").setHeading();

		new Setting(containerEl)
			.setName("Allow event overlap")
			.setDesc(
				"Allow events to visually overlap in all calendar views. When disabled, overlapping events display side-by-side in columns."
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.eventOverlap).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, eventOverlap: value }));
				})
			);

		new Setting(containerEl)
			.setName("Allow slot event overlap")
			.setDesc(
				"Allow events to overlap within the same time slot in time grid views. Only affects events that share exact slot boundaries."
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.slotEventOverlap).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, slotEventOverlap: value }));
				})
			);

		new Setting(containerEl)
			.setName("Event stack limit")
			.setDesc("Maximum number of events to stack vertically before showing '+ more' link (1-10)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_EVENT_MAX_STACK.toString())
					.setValue(settings.eventMaxStack.toString())
					.onChange(async (value) => {
						const stackLimit = parseInt(value, 10);
						if (!Number.isNaN(stackLimit) && stackLimit >= 1 && stackLimit <= 10) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								eventMaxStack: stackLimit,
							}));
						}
					})
			);
	}
}
