import { cls } from "@real1ty-obsidian-plugins";
import type { SchemaFieldOverride } from "@real1ty-obsidian-plugins/react";
import { SchemaSection, useSettingsStore } from "@real1ty-obsidian-plugins/react";
import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { type SingleCalendarConfig, SingleCalendarConfigSchema } from "../../types/settings";

interface PropertiesSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const FRONTMATTER_PROPERTY_FIELDS: Array<keyof SingleCalendarConfig> = [
	"startProp",
	"endProp",
	"dateProp",
	"allDayProp",
	"sortingStrategy",
	"sortDateProp",
	"titleProp",
	"calendarTitleProp",
	"zettelIdProp",
	"skipProp",
	"rruleProp",
	"rruleSpecProp",
	"rruleIdProp",
	"sourceProp",
	"instanceDateProp",
	"futureInstancesCountProp",
	"generatePastEventsProp",
	"statusProperty",
	"doneValue",
	"notDoneValue",
	"customDoneProperty",
	"customUndoneProperty",
	"categoryProp",
	"locationProp",
	"participantsProp",
	"breakProp",
	"iconProp",
	"prerequisiteProp",
	"minutesBeforeProp",
	"daysBeforeProp",
	"alreadyNotifiedProp",
	"caldavProp",
	"icsSubscriptionProp",
];

const FRONTMATTER_DISPLAY_FIELDS: Array<keyof SingleCalendarConfig> = [
	"frontmatterDisplayProperties",
	"frontmatterDisplayPropertiesAllDay",
	"frontmatterDisplayPropertiesUntracked",
	"frontmatterDisplayPropertiesHeatmap",
];

// Only overrides that can't live on the schema itself: enum option labels
// (UI-presentation strings that don't belong in data) and the section-level
// "Sorting normalization strategy" label that renames the field entirely.
// All other labels/placeholders come from `.meta({ title, placeholder })` in
// the schema, and placeholders fall back to each field's `.catch()` default.
const PROPERTY_OVERRIDES: Record<string, SchemaFieldOverride> = {
	sortingStrategy: {
		label: "Sorting normalization strategy",
		options: {
			none: "None",
			startDate: "Timed events only — start datetime",
			endDate: "Timed events only — end datetime",
			allDayOnly: "All-day events only",
			allStartDate: "All events — start datetime (Recommended)",
			allEndDate: "All events — end datetime",
		},
	},
};

const propLabel = (descriptor: { label: string }): string => descriptor.label.replace(/ Prop$/, " property");

const SHAPE = SingleCalendarConfigSchema.shape;

export const PropertiesSettingsReact = memo(function PropertiesSettingsReact({
	settingsStore,
}: PropertiesSettingsProps) {
	const [settings] = useSettingsStore(settingsStore);

	return (
		<>
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Frontmatter properties"
				fields={FRONTMATTER_PROPERTY_FIELDS as string[]}
				overrides={PROPERTY_OVERRIDES}
				labelTransform={propLabel}
			/>
			<EventTypesInfo settings={settings} />
			<RecurringEventsInfo settings={settings} />
			<FrontmatterDisplayIntro />
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Frontmatter display"
				fields={FRONTMATTER_DISPLAY_FIELDS as string[]}
			/>
		</>
	);
});

const EventTypesInfo = memo(function EventTypesInfo({ settings }: { settings: SingleCalendarConfig }) {
	return (
		<div className={cls("settings-info-box")}>
			<h4>Event types</h4>
			<p>There are two types of events: timed events and all-day events. Each uses different properties.</p>
			<div>
				<strong>Timed event example:</strong>
				<pre className={cls("settings-info-box-example")}>{`---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.allDayProp}: false
---

# Team Meeting`}</pre>
			</div>
			<div>
				<strong>All-day event example:</strong>
				<pre className={cls("settings-info-box-example")}>{`---
${settings.dateProp}: 2024-01-15
${settings.allDayProp}: true
---

# Conference Day`}</pre>
			</div>
		</div>
	);
});

const RRULE_TYPES = ["daily", "weekly", "bi-weekly", "monthly", "bi-monthly", "quarterly", "semi-annual", "yearly"];

const RecurringEventsInfo = memo(function RecurringEventsInfo({ settings }: { settings: SingleCalendarConfig }) {
	return (
		<div className={cls("settings-info-box")}>
			<h4>Recurring events</h4>
			<p>
				To create recurring events, add the rrule property to any event file's frontmatter. The plugin will
				automatically detect these and create recurring instances.
			</p>
			<div>
				<strong>Example</strong>
				<pre className={cls("settings-info-box-example")}>{`---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.rruleProp}: weekly
${settings.rruleSpecProp}: monday, wednesday, friday
${settings.futureInstancesCountProp}: 5
---

# Weekly Team Meeting`}</pre>
			</div>
			<div>
				<strong>Supported rrule types</strong>
				<ul>
					{RRULE_TYPES.map((type) => (
						<li key={type}>{type}</li>
					))}
				</ul>
			</div>
			<div>
				<strong>Rrule spec (for weekly and bi-weekly)</strong>
				<p>Comma-separated weekdays: sunday, monday, tuesday, wednesday, thursday, friday, saturday</p>
			</div>
		</div>
	);
});

const FrontmatterDisplayIntro = memo(function FrontmatterDisplayIntro() {
	return (
		<div>
			<p>
				Display additional frontmatter properties in calendar events. Properties appear below the event title in a 'key:
				value' format. If the event is too small to show all properties, the content is scrollable.
			</p>
			<p className="setting-item-description">
				Enter comma-separated property names (e.g., status, priority, project, tags). Only properties that exist in the
				note's frontmatter are displayed.
			</p>
		</div>
	);
});
