import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils";
import { Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfigSchema } from "../../types/settings";

export class PropertiesSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(private settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.addFrontmatterSettings(containerEl);
		this.addFrontmatterDisplaySettings(containerEl);
	}

	private addFrontmatterSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Frontmatter properties").setHeading();

		this.ui.addText(containerEl, {
			key: "startProp",
			name: "Start property",
			desc: "Frontmatter property name for event start date/time",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_START_PROP,
		});

		this.ui.addText(containerEl, {
			key: "endProp",
			name: "End property",
			desc: "Frontmatter property name for event end date/time (for timed events)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_END_PROP,
		});

		this.ui.addText(containerEl, {
			key: "dateProp",
			name: "Date property",
			desc: "Frontmatter property name for all-day events (date only, no time)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_DATE_PROP,
		});

		this.ui.addText(containerEl, {
			key: "allDayProp",
			name: "All-day property",
			desc: "Frontmatter property name for all-day flag",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_PROP,
		});

		this.ui.addText(containerEl, {
			key: "titleProp",
			name: "Title property",
			desc: "Frontmatter property name for event title (optional, defaults to file name)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_TITLE_PROP,
		});

		this.ui.addText(containerEl, {
			key: "zettelIdProp",
			name: "ZettelID property",
			desc: "Frontmatter property name for auto-generated ZettelID (optional, generates timestamp-based ID on creation/cloning)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_ZETTEL_ID_PROP,
		});

		this.ui.addText(containerEl, {
			key: "skipProp",
			name: "Skip property",
			desc: "Frontmatter property name to hide events from calendar (when set to true)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_SKIP_PROP,
		});

		this.ui.addText(containerEl, {
			key: "rruleProp",
			name: "RRule property",
			desc: "Frontmatter property name for recurring event type (daily, weekly, monthly, etc.)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_RRULE_PROP,
		});

		this.ui.addText(containerEl, {
			key: "rruleSpecProp",
			name: "RRule specification property",
			desc: "Frontmatter property name for recurring event specification (weekdays for weekly/bi-weekly events)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_RRULE_SPEC_PROP,
		});

		this.ui.addText(containerEl, {
			key: "rruleIdProp",
			name: "RRule ID property",
			desc: "Frontmatter property name for recurring event unique identifier",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_RRULE_ID_PROP,
		});

		this.ui.addText(containerEl, {
			key: "sourceProp",
			name: "Source property",
			desc: "Frontmatter property name for linking recurring event instances to their source event file",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_SOURCE_PROP,
		});

		this.ui.addText(containerEl, {
			key: "ignoreRecurringProp",
			name: "Ignore recurring property",
			desc: "Frontmatter property name for excluding duplicated recurring events from future instance generation (events with this set to true are tracked but don't count towards the future instances limit)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_IGNORE_RECURRING_PROP,
		});

		this.ui.addText(containerEl, {
			key: "futureInstancesCountProp",
			name: "Future instances count property",
			desc: "Frontmatter property name for per-event override of future instances count (defaults to global setting if not specified)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_FUTURE_INSTANCES_COUNT_PROP,
		});

		this.ui.addText(containerEl, {
			key: "statusProperty",
			name: "Status property",
			desc: "Frontmatter property name for event status (used when automatically marking past events as done)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_STATUS_PROPERTY,
		});

		this.ui.addText(containerEl, {
			key: "doneValue",
			name: "Done value",
			desc: "Value to set in the status property when marking an event as done",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_DONE_VALUE,
		});

		this.ui.addText(containerEl, {
			key: "categoryProp",
			name: "Category property",
			desc: "Frontmatter property name for event categories (used for grouping in statistics)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_CATEGORY_PROP,
		});

		this.ui.addText(containerEl, {
			key: "breakProp",
			name: "Break property",
			desc: "Frontmatter property name for break time in minutes (subtracted from event duration in statistics, supports decimals)",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_BREAK_PROP,
		});

		// Add description for event types
		const eventTypesDesc = containerEl.createDiv(cls("settings-info-box"));

		eventTypesDesc.createEl("h4", { text: "Event types" });
		eventTypesDesc.createEl("p", {
			text: "There are two types of events: timed events and all-day events. Each uses different properties.",
		});

		const timedExample = eventTypesDesc.createDiv();
		timedExample.createEl("strong", { text: "Timed event example:" });
		timedExample.createEl("pre", {
			text: `---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.allDayProp}: false
---

# Team Meeting`,
			cls: cls("settings-info-box-example"),
		});

		const allDayExample = eventTypesDesc.createDiv();
		allDayExample.createEl("strong", { text: "All-day event example:" });
		allDayExample.createEl("pre", {
			text: `---
${settings.dateProp}: 2024-01-15
${settings.allDayProp}: true
---

# Conference Day`,
			cls: cls("settings-info-box-example"),
		});

		// Add description for recurring events
		const recurringDesc = containerEl.createDiv(cls("settings-info-box"));

		recurringDesc.createEl("h4", { text: "Recurring events" });
		recurringDesc.createEl("p", {
			text: "To create recurring events, add the rrule property to any event file's frontmatter. The plugin will automatically detect these and create recurring instances.",
		});

		const recurringExample = recurringDesc.createDiv();
		recurringExample.createEl("strong", { text: "Example" });
		recurringExample.createEl("pre", {
			text: `---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.rruleProp}: weekly
${settings.rruleSpecProp}: monday, wednesday, friday
${settings.futureInstancesCountProp}: 5
---

# Weekly Team Meeting`,
			cls: cls("settings-info-box-example"),
		});

		const typesContainer = recurringDesc.createDiv();
		typesContainer.createEl("strong", { text: "Supported rrule types" });
		const typesList = typesContainer.createEl("ul");
		["daily", "weekly", "bi-weekly", "monthly", "bi-monthly", "yearly"].forEach((type) => {
			typesList.createEl("li", { text: type });
		});

		const specContainer = recurringDesc.createDiv();
		specContainer.createEl("strong", { text: "Rrule spec (for weekly and bi-weekly)" });
		specContainer.createEl("p", {
			text: "Comma-separated weekdays: sunday, monday, tuesday, wednesday, thursday, friday, saturday",
		});
	}

	private addFrontmatterDisplaySettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Frontmatter display").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Display additional frontmatter properties in calendar events. Properties will appear below the event title in a 'key: value' format. If the event is too small to show all properties, the content will be scrollable.",
		});
		desc.createEl("p", {
			text: "Enter comma-separated property names (e.g., status, priority, project, tags). Only properties that exist in the note's frontmatter will be displayed.",
			cls: "setting-item-description",
		});

		this.ui.addTextArray(containerEl, {
			key: "frontmatterDisplayProperties",
			name: "Display properties (timed events)",
			desc: "Comma-separated list of frontmatter property names to display in timed events (events with start and end times). Properties are shown in weekly and daily views, but hidden in monthly view to save space.",
			placeholder: "status, priority, project, tags, category",
			arrayDelimiter: ", ",
		});

		this.ui.addTextArray(containerEl, {
			key: "frontmatterDisplayPropertiesAllDay",
			name: "Display properties (all-day events)",
			desc: "Comma-separated list of frontmatter property names to display in all-day events. Properties are shown in weekly and daily views, but hidden in monthly view to save space.",
			placeholder: "status, priority, project, tags, category",
			arrayDelimiter: ", ",
		});

		// Add example display
		const exampleContainer = containerEl.createDiv(cls("frontmatter-display-example"));
		exampleContainer.createEl("p", {
			text: "Example display in calendar:",
			cls: "setting-item-description",
		});

		const exampleBox = exampleContainer.createDiv(cls("example-event-box"));
		exampleBox.createEl("div", { text: "Meeting with team", cls: cls("title") });
		const propertiesContainer = exampleBox.createDiv(cls("properties"));
		propertiesContainer.createEl("div", { text: "Status: in progress" });
		propertiesContainer.createEl("div", { text: "Priority: high" });
		propertiesContainer.createEl("div", { text: "Project: q4 planning" });
	}
}
