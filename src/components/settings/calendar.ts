import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import {
	DEFAULT_CONNECTION_COLOR,
	DEFAULT_EVENT_TEXT_COLOR,
	DEFAULT_EVENT_TEXT_COLOR_ALT,
	DEFAULT_MONTH_EVEN_COLOR,
	DEFAULT_MONTH_ODD_COLOR,
	DEFAULT_ZOOM_LEVELS,
} from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import {
	CALENDAR_VIEW_OPTIONS,
	type CalendarViewType,
	DAY_CELL_COLORING_OPTIONS,
	DENSITY_OPTIONS,
	FIRST_DAY_OPTIONS,
} from "../../types/index";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

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

		this.ui.addSchemaField(containerEl, { hideWeekends: S.hideWeekends });
		this.ui.addSchemaField(containerEl, { enableEventPreview: S.enableEventPreview });
		this.ui.addSchemaField(containerEl, { skipUnderscoreProperties: S.skipUnderscoreProperties });
		this.ui.addSchemaField(containerEl, { nowIndicator: S.nowIndicator }, { label: "Show current time indicator" });
		this.ui.addSchemaField(containerEl, { highlightUpcomingEvent: S.highlightUpcomingEvent });
		this.ui.addSchemaField(containerEl, { thickerHourLines: S.thickerHourLines });

		this.renderDayCellColoringSection(containerEl);

		this.ui.addSchemaField(
			containerEl,
			{ showDurationInTitle: S.showDurationInTitle },
			{ label: "Show duration in event title" }
		);
		this.ui.addSchemaField(containerEl, { stickyDayHeaders: S.stickyDayHeaders });
		this.ui.addSchemaField(containerEl, { stickyAllDayEvents: S.stickyAllDayEvents });
		this.ui.addSchemaField(containerEl, { allDayEventHeight: S.allDayEventHeight }, { step: 5 });
		this.ui.addSchemaField(containerEl, { pastEventContrast: S.pastEventContrast });

		// First day of week — custom parseInt conversion
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

		this.ui.addSchemaField(containerEl, { hourStart: S.hourStart }, { label: "Day start hour" });
		this.ui.addSchemaField(containerEl, { hourEnd: S.hourEnd }, { label: "Day end hour" });
		this.ui.addSchemaField(containerEl, { slotDurationMinutes: S.slotDurationMinutes });
		this.ui.addSchemaField(containerEl, { snapDurationMinutes: S.snapDurationMinutes });
		this.ui.addSchemaField(containerEl, { dragEdgeScrollDelayMs: S.dragEdgeScrollDelayMs }, { step: 50 });

		// Zoom levels — custom textarea with number parsing
		new Setting(containerEl)
			.setName("Zoom levels (minutes)")
			.setDesc("Available zoom levels for Ctrl+scroll zooming. Enter comma-separated values (1-60 minutes each)")
			.addTextArea((text) => {
				text.setPlaceholder(DEFAULT_ZOOM_LEVELS.join(", "));
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

		// Display density — custom casting
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

		new Setting(containerEl).setName("Event overlap").setHeading();

		this.ui.addSchemaField(containerEl, { eventOverlap: S.eventOverlap }, { label: "Allow event overlap" });
		this.ui.addSchemaField(
			containerEl,
			{ slotEventOverlap: S.slotEventOverlap },
			{ label: "Allow slot event overlap" }
		);
		this.ui.addSchemaField(containerEl, { eventMaxStack: S.eventMaxStack }, { label: "Event stack limit" });
		this.ui.addSchemaField(
			containerEl,
			{ desktopMaxEventsPerDay: S.desktopMaxEventsPerDay },
			{ label: "Desktop events per day" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ mobileMaxEventsPerDay: S.mobileMaxEventsPerDay },
			{ label: "Mobile events per day" }
		);

		this.ui.addSchemaField(containerEl, { showColorDots: S.showColorDots });

		new Setting(containerEl).setName("Event text colors").setHeading();

		this.ui.addColorPicker(containerEl, {
			key: "eventTextColor",
			name: "Default event text color",
			desc: "Text color for events with dark backgrounds (default: white)",
			fallback: DEFAULT_EVENT_TEXT_COLOR,
		});

		this.ui.addColorPicker(containerEl, {
			key: "eventTextColorAlt",
			name: "Alternative event text color",
			desc: "Text color used when event background is light or white (e.g., pastel colors) for better contrast",
			fallback: DEFAULT_EVENT_TEXT_COLOR_ALT,
		});

		new Setting(containerEl).setHeading().setName("Capacity Tracking");

		this.ui.addSchemaField(
			containerEl,
			{ capacityTrackingEnabled: S.capacityTrackingEnabled },
			{ label: "Enable capacity tracking" }
		);

		new Setting(containerEl).setHeading().setName("Prerequisite Connection Arrows");

		this.ui.addColorPicker(containerEl, {
			key: "connectionColor",
			name: "Arrow color",
			desc: "Color of the prerequisite connection arrows on the Calendar tab",
			fallback: DEFAULT_CONNECTION_COLOR,
		});

		this.ui.addSchemaField(
			containerEl,
			{ connectionStrokeWidth: S.connectionStrokeWidth },
			{ label: "Line thickness" }
		);
		this.ui.addSchemaField(containerEl, { connectionArrowSize: S.connectionArrowSize }, { label: "Arrowhead size" });
	}

	private renderDayCellColoringSection(containerEl: HTMLElement): void {
		const colorPickersWrapper = containerEl.createDiv();

		const renderColorPickers = (): void => {
			colorPickersWrapper.empty();
			const mode = this.settingsStore.currentSettings.dayCellColoring;

			if (mode === "uniform") {
				this.ui.addColorPicker(colorPickersWrapper, {
					key: "monthEvenColor",
					name: "Day background color",
					desc: "Gradient color applied uniformly to all day cells in every view",
					fallback: DEFAULT_MONTH_EVEN_COLOR,
				});
			} else if (mode === "boundary") {
				this.ui.addColorPicker(colorPickersWrapper, {
					key: "monthEvenColor",
					name: "Even month color",
					desc: "Gradient color for even months (January, March, May, July, September, November)",
					fallback: DEFAULT_MONTH_EVEN_COLOR,
				});

				this.ui.addColorPicker(colorPickersWrapper, {
					key: "monthOddColor",
					name: "Odd month color",
					desc: "Gradient color for odd months (February, April, June, August, October, December)",
					fallback: DEFAULT_MONTH_ODD_COLOR,
				});
			}
		};

		this.ui.addDropdown(containerEl, {
			key: "dayCellColoring",
			name: "Day cell coloring",
			desc: "Controls the background coloring of day cells. Off: default calendar appearance. Uniform: applies a single gradient color to all day cells. Month boundary: alternates two gradient colors by even/odd month, making month transitions clearly visible.",
			options: DAY_CELL_COLORING_OPTIONS,
			onChanged: renderColorPickers,
		});

		containerEl.appendChild(colorPickersWrapper);
		renderColorPickers();
	}
}
