import { Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";

export class PropertiesSettings {
	constructor(private settingsStore: CalendarSettingsStore) {}

	display(containerEl: HTMLElement): void {
		this.addFrontmatterSettings(containerEl);
		this.addFrontmatterDisplaySettings(containerEl);
	}

	private addFrontmatterSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Frontmatter properties").setHeading();

		new Setting(containerEl)
			.setName("Start property")
			.setDesc("Frontmatter property name for event start date/time")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_START_PROP)
					.setValue(settings.startProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							startProp: value || SETTINGS_DEFAULTS.DEFAULT_START_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("End property")
			.setDesc("Frontmatter property name for event end date/time (for timed events)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_END_PROP)
					.setValue(settings.endProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							endProp: value || SETTINGS_DEFAULTS.DEFAULT_END_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("Date property")
			.setDesc("Frontmatter property name for all-day events (date only, no time)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_DATE_PROP)
					.setValue(settings.dateProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							dateProp: value || SETTINGS_DEFAULTS.DEFAULT_DATE_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("All-day property")
			.setDesc("Frontmatter property name for all-day flag")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_PROP)
					.setValue(settings.allDayProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							allDayProp: value || SETTINGS_DEFAULTS.DEFAULT_ALL_DAY_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("Title property")
			.setDesc("Frontmatter property name for event title (optional, defaults to file name)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_TITLE_PROP)
					.setValue(settings.titleProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, titleProp: value }));
					})
			);

		new Setting(containerEl)
			.setName("ZettelID property")
			.setDesc(
				"Frontmatter property name for auto-generated ZettelID (optional, generates timestamp-based ID on creation/cloning)"
			)
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_ZETTEL_ID_PROP)
					.setValue(settings.zettelIdProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, zettelIdProp: value }));
					})
			);

		new Setting(containerEl)
			.setName("Skip property")
			.setDesc("Frontmatter property name to hide events from calendar (when set to true)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_SKIP_PROP)
					.setValue(settings.skipProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							skipProp: value || SETTINGS_DEFAULTS.DEFAULT_SKIP_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("RRule property")
			.setDesc("Frontmatter property name for recurring event type (daily, weekly, monthly, etc.)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_RRULE_PROP)
					.setValue(settings.rruleProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							rruleProp: value || SETTINGS_DEFAULTS.DEFAULT_RRULE_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("RRule specification property")
			.setDesc("Frontmatter property name for recurring event specification (weekdays for weekly/bi-weekly events)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_RRULE_SPEC_PROP)
					.setValue(settings.rruleSpecProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							rruleSpecProp: value || SETTINGS_DEFAULTS.DEFAULT_RRULE_SPEC_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("RRule ID property")
			.setDesc("Frontmatter property name for recurring event unique identifier")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_RRULE_ID_PROP)
					.setValue(settings.rruleIdProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							rruleIdProp: value || SETTINGS_DEFAULTS.DEFAULT_RRULE_ID_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("Source property")
			.setDesc("Frontmatter property name for linking recurring event instances to their source event file")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_SOURCE_PROP)
					.setValue(settings.sourceProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							sourceProp: value || SETTINGS_DEFAULTS.DEFAULT_SOURCE_PROP,
						}));
					})
			);

		new Setting(containerEl)
			.setName("Status property")
			.setDesc("Frontmatter property name for event status (used when automatically marking past events as done)")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_STATUS_PROPERTY)
					.setValue(settings.statusProperty)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							statusProperty: value || SETTINGS_DEFAULTS.DEFAULT_STATUS_PROPERTY,
						}));
					})
			);

		new Setting(containerEl)
			.setName("Done value")
			.setDesc("Value to set in the status property when marking an event as done")
			.addText((text) =>
				text
					.setPlaceholder(SETTINGS_DEFAULTS.DEFAULT_DONE_VALUE)
					.setValue(settings.doneValue)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							doneValue: value || SETTINGS_DEFAULTS.DEFAULT_DONE_VALUE,
						}));
					})
			);

		// Add description for event types
		const eventTypesDesc = containerEl.createDiv("settings-info-box");

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
			cls: "settings-info-box-example",
		});

		const allDayExample = eventTypesDesc.createDiv();
		allDayExample.createEl("strong", { text: "All-day event example:" });
		allDayExample.createEl("pre", {
			text: `---
${settings.dateProp}: 2024-01-15
${settings.allDayProp}: true
---

# Conference Day`,
			cls: "settings-info-box-example",
		});

		// Add description for recurring events
		const recurringDesc = containerEl.createDiv("settings-info-box");

		recurringDesc.createEl("h4", { text: "Recurring events" });
		recurringDesc.createEl("p", {
			text: "To create recurring events, add the RRule property to any event file's frontmatter. The plugin will automatically detect these and create recurring instances.",
		});

		const recurringExample = recurringDesc.createDiv();
		recurringExample.createEl("strong", { text: "Example:" });
		recurringExample.createEl("pre", {
			text: `---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.rruleProp}: weekly
${settings.rruleSpecProp}: monday, wednesday, friday
---

# Weekly Team Meeting`,
			cls: "settings-info-box-example",
		});

		const typesContainer = recurringDesc.createDiv();
		typesContainer.createEl("strong", { text: "Supported RRule types" });
		const typesList = typesContainer.createEl("ul");
		["daily", "weekly", "bi-weekly", "monthly", "bi-monthly", "yearly"].forEach((type) => {
			typesList.createEl("li", { text: type });
		});

		const specContainer = recurringDesc.createDiv();
		specContainer.createEl("strong", { text: "RRuleSpec (for weekly/bi-weekly)" });
		specContainer.createEl("p", {
			text: "Comma-separated weekdays: sunday, monday, tuesday, wednesday, thursday, friday, saturday",
		});
	}

	private addFrontmatterDisplaySettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Frontmatter display").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Display additional frontmatter properties in calendar events. Properties will appear below the event title in a 'key: value' format. If the event is too small to show all properties, the content will be scrollable.",
		});
		desc.createEl("p", {
			text: "Enter comma-separated property names (e.g., status, priority, project, tags). Only properties that exist in the note's frontmatter will be displayed.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Display properties")
			.setDesc("Comma-separated list of frontmatter property names to display in events")
			.addTextArea((text) => {
				text.setPlaceholder("status, priority, project, tags, category");
				text.setValue(settings.frontmatterDisplayProperties.join(", "));
				text.onChange(async (value) => {
					const properties = value
						.split(",")
						.map((prop) => prop.trim())
						.filter((prop) => prop.length > 0);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						frontmatterDisplayProperties: properties,
					}));
				});
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
			});

		// Add example display
		const exampleContainer = containerEl.createDiv("frontmatter-display-example");
		exampleContainer.createEl("p", {
			text: "Example display in calendar:",
			cls: "setting-item-description",
		});

		const exampleBox = exampleContainer.createDiv("example-event-box");
		exampleBox.createEl("div", { text: "Meeting with Team", cls: "title" });
		const propertiesContainer = exampleBox.createDiv("properties");
		propertiesContainer.createEl("div", { text: "status: In Progress" });
		propertiesContainer.createEl("div", { text: "priority: High" });
		propertiesContainer.createEl("div", { text: "project: Q4 Planning" });
	}
}
