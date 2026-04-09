import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import { PROP_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

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

		this.ui.addSchemaField(
			containerEl,
			{ startProp: S.startProp },
			{ label: "Start property", placeholder: PROP_DEFAULTS.start }
		);
		this.ui.addSchemaField(
			containerEl,
			{ endProp: S.endProp },
			{ label: "End property", placeholder: PROP_DEFAULTS.end }
		);
		this.ui.addSchemaField(
			containerEl,
			{ dateProp: S.dateProp },
			{ label: "Date property", placeholder: PROP_DEFAULTS.date }
		);
		this.ui.addSchemaField(
			containerEl,
			{ allDayProp: S.allDayProp },
			{ label: "All-day property", placeholder: PROP_DEFAULTS.allDay }
		);

		this.ui.addSchemaField(
			containerEl,
			{ sortingStrategy: S.sortingStrategy },
			{
				label: "Sorting normalization strategy",
				options: {
					none: "None",
					startDate: "Timed events only — start datetime",
					endDate: "Timed events only — end datetime",
					allDayOnly: "All-day events only",
					allStartDate: "All events — start datetime (Recommended)",
					allEndDate: "All events — end datetime",
				},
			}
		);

		this.ui.addSchemaField(
			containerEl,
			{ sortDateProp: S.sortDateProp },
			{ label: "Sort date property", placeholder: PROP_DEFAULTS.sortDate }
		);
		this.ui.addSchemaField(
			containerEl,
			{ titleProp: S.titleProp },
			{ label: "Title property", placeholder: PROP_DEFAULTS.title }
		);
		this.ui.addSchemaField(
			containerEl,
			{ calendarTitleProp: S.calendarTitleProp },
			{ label: "Calendar title property", placeholder: PROP_DEFAULTS.calendarTitle }
		);
		this.ui.addSchemaField(
			containerEl,
			{ zettelIdProp: S.zettelIdProp },
			{ label: "ZettelID property", placeholder: PROP_DEFAULTS.zettelId }
		);
		this.ui.addSchemaField(
			containerEl,
			{ skipProp: S.skipProp },
			{ label: "Skip property", placeholder: PROP_DEFAULTS.skip }
		);
		this.ui.addSchemaField(
			containerEl,
			{ rruleProp: S.rruleProp },
			{ label: "RRule property", placeholder: PROP_DEFAULTS.rrule }
		);
		this.ui.addSchemaField(
			containerEl,
			{ rruleSpecProp: S.rruleSpecProp },
			{ label: "RRule specification property", placeholder: PROP_DEFAULTS.rruleSpec }
		);
		this.ui.addSchemaField(
			containerEl,
			{ rruleIdProp: S.rruleIdProp },
			{ label: "RRule ID property", placeholder: PROP_DEFAULTS.rruleId }
		);
		this.ui.addSchemaField(
			containerEl,
			{ sourceProp: S.sourceProp },
			{ label: "Source property", placeholder: PROP_DEFAULTS.source }
		);
		this.ui.addSchemaField(
			containerEl,
			{ instanceDateProp: S.instanceDateProp },
			{ label: "Recurring instance date property", placeholder: PROP_DEFAULTS.instanceDate }
		);
		this.ui.addSchemaField(
			containerEl,
			{ futureInstancesCountProp: S.futureInstancesCountProp },
			{ label: "Future instances count property", placeholder: PROP_DEFAULTS.futureInstancesCount }
		);
		this.ui.addSchemaField(
			containerEl,
			{ generatePastEventsProp: S.generatePastEventsProp },
			{ label: "Generate past events property", placeholder: PROP_DEFAULTS.generatePastEvents }
		);
		this.ui.addSchemaField(
			containerEl,
			{ statusProperty: S.statusProperty },
			{ label: "Status property", placeholder: PROP_DEFAULTS.status }
		);
		this.ui.addSchemaField(containerEl, { doneValue: S.doneValue }, { placeholder: PROP_DEFAULTS.doneValue });
		this.ui.addSchemaField(containerEl, { notDoneValue: S.notDoneValue }, { placeholder: PROP_DEFAULTS.notDoneValue });
		this.ui.addSchemaField(containerEl, { customDoneProperty: S.customDoneProperty }, { placeholder: "archived true" });
		this.ui.addSchemaField(
			containerEl,
			{ customUndoneProperty: S.customUndoneProperty },
			{ placeholder: "archived false" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ categoryProp: S.categoryProp },
			{ label: "Category property", placeholder: PROP_DEFAULTS.category }
		);
		this.ui.addSchemaField(
			containerEl,
			{ locationProp: S.locationProp },
			{ label: "Location property", placeholder: PROP_DEFAULTS.location }
		);
		this.ui.addSchemaField(
			containerEl,
			{ participantsProp: S.participantsProp },
			{ label: "Participants property", placeholder: PROP_DEFAULTS.participants }
		);
		this.ui.addSchemaField(
			containerEl,
			{ breakProp: S.breakProp },
			{ label: "Break property", placeholder: PROP_DEFAULTS.break }
		);
		this.ui.addSchemaField(
			containerEl,
			{ iconProp: S.iconProp },
			{ label: "Icon property", placeholder: PROP_DEFAULTS.icon }
		);
		this.ui.addSchemaField(
			containerEl,
			{ prerequisiteProp: S.prerequisiteProp },
			{ label: "Prerequisite property", placeholder: PROP_DEFAULTS.prerequisite }
		);
		this.ui.addSchemaField(
			containerEl,
			{ minutesBeforeProp: S.minutesBeforeProp },
			{ label: "Minutes before property", placeholder: PROP_DEFAULTS.minutesBefore }
		);
		this.ui.addSchemaField(
			containerEl,
			{ daysBeforeProp: S.daysBeforeProp },
			{ label: "Days before property", placeholder: PROP_DEFAULTS.daysBefore }
		);
		this.ui.addSchemaField(
			containerEl,
			{ alreadyNotifiedProp: S.alreadyNotifiedProp },
			{ label: "Already notified property", placeholder: PROP_DEFAULTS.alreadyNotified }
		);
		this.ui.addSchemaField(
			containerEl,
			{ caldavProp: S.caldavProp },
			{ label: "CalDAV property", placeholder: PROP_DEFAULTS.caldav }
		);
		this.ui.addSchemaField(
			containerEl,
			{ icsSubscriptionProp: S.icsSubscriptionProp },
			{ label: "ICS subscription property", placeholder: PROP_DEFAULTS.icsSubscription }
		);

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
		["daily", "weekly", "bi-weekly", "monthly", "bi-monthly", "quarterly", "semi-annual", "yearly"].forEach((type) => {
			typesList.createEl("li", { text: type });
		});

		const specContainer = recurringDesc.createDiv();
		specContainer.createEl("strong", {
			text: "Rrule spec (for weekly and bi-weekly)",
		});
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

		this.ui.addSchemaField(
			containerEl,
			{ frontmatterDisplayProperties: S.frontmatterDisplayProperties },
			{ label: "Display properties (timed events)", placeholder: "status, priority, project, tags, category" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ frontmatterDisplayPropertiesAllDay: S.frontmatterDisplayPropertiesAllDay },
			{ label: "Display properties (all-day events)", placeholder: "status, priority, project, tags, category" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ frontmatterDisplayPropertiesUntracked: S.frontmatterDisplayPropertiesUntracked },
			{ label: "Display properties (untracked events)", placeholder: "status, priority, project, tags, category" }
		);
		this.ui.addSchemaField(
			containerEl,
			{ frontmatterDisplayPropertiesHeatmap: S.frontmatterDisplayPropertiesHeatmap },
			{ label: "Display properties (heatmap)", placeholder: "status, priority, project, tags, category" }
		);
	}
}
