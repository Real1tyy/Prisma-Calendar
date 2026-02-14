import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { CALENDAR_VIEW_OPTIONS, type CalendarViewType, DENSITY_OPTIONS, FIRST_DAY_OPTIONS } from "../../types/index";
import type { SingleCalendarConfigSchema } from "../../types/settings";

export class CalendarSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(private settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.addUISettings(containerEl);
	}

	private addUISettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("User interface").setHeading();

		const addViewDropdown = (name: string, desc: string, key: "defaultView" | "defaultMobileView"): void => {
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addDropdown((dropdown) => {
					Object.entries(CALENDAR_VIEW_OPTIONS).forEach(([value, label]) => {
						dropdown.addOption(value, label);
					});

					dropdown.setValue(this.settingsStore.currentSettings[key]).onChange(async (value: string) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							[key]: value as CalendarViewType,
						}));
					});
				});
		};

		addViewDropdown("Default view", "The calendar view to show when opening", "defaultView");
		addViewDropdown(
			"Default mobile view",
			"The calendar view to show when opening on mobile devices (screen width ≤ 768px)",
			"defaultMobileView"
		);

		this.ui.addToggle(containerEl, {
			key: "hideWeekends",
			name: "Hide weekends",
			desc: "Hide Saturday and Sunday in calendar views",
		});

		this.ui.addToggle(containerEl, {
			key: "enableEventPreview",
			name: "Enable event preview",
			desc: "Show preview of event notes when hovering over events in the calendar",
		});

		this.ui.addToggle(containerEl, {
			key: "skipUnderscoreProperties",
			name: "Skip underscore properties",
			desc: "Hide frontmatter properties that start with underscore (e.g., _ZettelID) in event previews and edit modals",
		});

		this.ui.addToggle(containerEl, {
			key: "nowIndicator",
			name: "Show current time indicator",
			desc: "Display a line showing the current time in weekly and daily calendar views",
		});

		this.ui.addToggle(containerEl, {
			key: "highlightUpcomingEvent",
			name: "Highlight upcoming event",
			desc: "Subtly highlight events that are currently active (if any), or the next upcoming event. Only visible when the current time is within the visible date range.",
		});

		this.ui.addToggle(containerEl, {
			key: "thickerHourLines",
			name: "Thicker hour lines",
			desc: "Make full-hour lines (12:00, 13:00, etc.) thicker in day and week views for better visual contrast",
		});

		this.ui.addToggle(containerEl, {
			key: "showDurationInTitle",
			name: "Show duration in event title",
			desc: "Display event duration (e.g., 2h 30m) in parentheses after the event title for timed events",
		});

		this.ui.addToggle(containerEl, {
			key: "stickyDayHeaders",
			name: "Sticky day headers",
			desc: "Keep day/date headers visible at the top when scrolling down in weekly and daily views",
		});

		this.ui.addToggle(containerEl, {
			key: "stickyAllDayEvents",
			name: "Sticky all-day events",
			desc: "Keep all-day event section visible at the top when scrolling down in weekly and daily views",
		});

		this.ui.addSlider(containerEl, {
			key: "allDayEventHeight",
			name: "All-day event height",
			desc: "Maximum height in pixels for all-day events section before overflow (30-500px)",
			min: 30,
			max: 500,
			step: 5,
		});

		this.ui.addSlider(containerEl, {
			key: "pastEventContrast",
			name: "Past event contrast",
			desc: "Visual contrast of past events (0% = invisible, 100% = normal)",
			min: 0,
			max: 100,
			step: 1,
		});

		// First day of week dropdown
		new Setting(containerEl)
			.setName("First day of week")
			.setDesc("Which day should be the first day of the week in calendar views")
			.addDropdown((dropdown) => {
				Object.entries(FIRST_DAY_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown
					.setValue(this.settingsStore.currentSettings.firstDayOfWeek.toString())
					.onChange(async (value: string) => {
						const dayNumber = parseInt(value, 10);
						if (!Number.isNaN(dayNumber) && dayNumber >= 0 && dayNumber <= 6) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								firstDayOfWeek: dayNumber,
							}));
						}
					});
			});

		this.ui.addSlider(containerEl, {
			key: "hourStart",
			name: "Day start hour",
			desc: "First hour to show in time grid views",
			min: 0,
			max: 23,
			step: 1,
		});

		this.ui.addSlider(containerEl, {
			key: "hourEnd",
			name: "Day end hour",
			desc: "Last hour to show in time grid views",
			min: 1,
			max: 24,
			step: 1,
		});

		this.ui.addSlider(containerEl, {
			key: "slotDurationMinutes",
			name: "Slot duration (minutes)",
			desc: "Duration of time slots in the calendar grid (1-60 minutes)",
			min: 1,
			max: 60,
			step: 1,
		});

		this.ui.addSlider(containerEl, {
			key: "snapDurationMinutes",
			name: "Snap duration (minutes)",
			desc: "Snap interval when dragging or resizing events (1-60 minutes)",
			min: 1,
			max: 60,
			step: 1,
		});

		this.ui.addSlider(containerEl, {
			key: "dragEdgeScrollDelayMs",
			name: "Drag edge scroll delay (ms)",
			desc: "Delay in milliseconds before scrolling when dragging events near the edge (50-2000ms)",
			min: 50,
			max: 2000,
			step: 50,
		});

		new Setting(containerEl)
			.setName("Zoom levels (minutes)")
			.setDesc("Available zoom levels for Ctrl+scroll zooming. Enter comma-separated values (1-60 minutes each)")
			.addTextArea((text) => {
				text.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_ZOOM_LEVELS.join(", "));
				text.setValue(this.settingsStore.currentSettings.zoomLevels.join(", "));
				text.onChange(async (value) => {
					const levels = value
						.split(",")
						.map((level) => parseInt(level.trim(), 10))
						.filter((level) => !Number.isNaN(level) && level >= 1 && level <= 60)
						.sort((a, b) => a - b);

					if (levels.length > 0) {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							zoomLevels: levels,
						}));
					}
				});
				text.inputEl.rows = 2;
			});

		// Display density dropdown
		new Setting(containerEl)
			.setName("Display density")
			.setDesc("How compact to make the calendar display")
			.addDropdown((dropdown) => {
				Object.entries(DENSITY_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(this.settingsStore.currentSettings.density).onChange(async (value: string) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						density: value as "comfortable" | "compact",
					}));
				});
			});

		// Event overlap settings section
		new Setting(containerEl).setName("Event overlap").setHeading();

		this.ui.addToggle(containerEl, {
			key: "eventOverlap",
			name: "Allow event overlap",
			desc: "Allow events to visually overlap in all calendar views. When disabled, overlapping events display side-by-side in columns.",
		});

		this.ui.addToggle(containerEl, {
			key: "slotEventOverlap",
			name: "Allow slot event overlap",
			desc: "Allow events to overlap within the same time slot in time grid views. Only affects events that share exact slot boundaries.",
		});

		this.ui.addSlider(containerEl, {
			key: "eventMaxStack",
			name: "Event stack limit",
			desc: "Maximum number of events to stack vertically before showing '+ more' link (1-10)",
			min: 1,
			max: 10,
			step: 1,
		});

		this.ui.addSlider(containerEl, {
			key: "desktopMaxEventsPerDay",
			name: "Desktop events per day",
			desc: "Maximum events to show per day on desktop before showing '+more' link (0-10, 0 = unlimited)",
			min: 0,
			max: 10,
			step: 1,
		});

		this.ui.addSlider(containerEl, {
			key: "mobileMaxEventsPerDay",
			name: "Mobile events per day",
			desc: "Maximum events to show per day on mobile before showing '+more' link (0-10, 0 = unlimited)",
			min: 0,
			max: 10,
			step: 1,
		});

		this.ui.addToggle(containerEl, {
			key: "showColorDots",
			name: "Show color dots",
			desc: "Show color indicator dots at the top of each day in monthly view",
		});

		// Event text colors
		new Setting(containerEl).setName("Event text colors").setHeading();

		this.ui.addColorPicker(containerEl, {
			key: "eventTextColor",
			name: "Default event text color",
			desc: "Text color for events with dark backgrounds (default: white)",
			fallback: SETTINGS_DEFAULTS.DEFAULT_EVENT_TEXT_COLOR,
		});

		this.ui.addColorPicker(containerEl, {
			key: "eventTextColorAlt",
			name: "Alternative event text color",
			desc: "Text color used when event background is light or white (e.g., pastel colors) for better contrast",
			fallback: SETTINGS_DEFAULTS.DEFAULT_EVENT_TEXT_COLOR_ALT,
		});
	}
}
