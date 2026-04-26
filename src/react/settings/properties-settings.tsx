import { cls } from "@real1ty-obsidian-plugins";
import { SchemaSection, useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { type SingleCalendarConfig, SingleCalendarConfigSchema } from "../../types/settings";

interface PropertiesSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const TIMING_FIELDS = ["startProp", "endProp", "dateProp", "allDayProp"];
const SORTING_FIELDS = ["sortingStrategy", "sortDateProp"];
const IDENTITY_FIELDS = ["titleProp", "calendarTitleProp", "zettelIdProp", "skipProp", "iconProp"];
const RECURRENCE_FIELDS = [
	"rruleProp",
	"rruleSpecProp",
	"rruleUntilProp",
	"rruleIdProp",
	"sourceProp",
	"instanceDateProp",
	"futureInstancesCountProp",
	"generatePastEventsProp",
];
const STATUS_FIELDS = ["statusProperty", "doneValue", "notDoneValue", "customDoneProperty", "customUndoneProperty"];
const METADATA_FIELDS = ["categoryProp", "locationProp", "participantsProp", "breakProp", "prerequisiteProp"];
const NOTIFICATION_PROP_FIELDS = ["minutesBeforeProp", "daysBeforeProp", "alreadyNotifiedProp"];
const INTEGRATION_PROP_FIELDS = ["caldavProp", "icsSubscriptionProp"];
const DISPLAY_FIELDS = [
	"frontmatterDisplayProperties",
	"frontmatterDisplayPropertiesAllDay",
	"frontmatterDisplayPropertiesUntracked",
	"frontmatterDisplayPropertiesHeatmap",
];

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
				heading="Event timing"
				fields={TIMING_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>
			<EventTypesInfo settings={settings} />

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Sorting"
				fields={SORTING_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Identity"
				fields={IDENTITY_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Recurrence"
				fields={RECURRENCE_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>
			<RecurringEventsInfo settings={settings} />

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Status"
				fields={STATUS_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Metadata"
				fields={METADATA_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Notifications"
				fields={NOTIFICATION_PROP_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>

			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Integrations"
				fields={INTEGRATION_PROP_FIELDS}
				labelTransform={propLabel}
				testIdPrefix="prisma-settings-"
			/>

			<FrontmatterDisplayIntro />
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Display in events"
				fields={DISPLAY_FIELDS}
				testIdPrefix="prisma-settings-"
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
${settings.rruleUntilProp}: 2024-05-31
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
				Display additional frontmatter properties in events. Properties appear below the event title in a 'key: value'
				format. If the event is too small to show all properties, the content is scrollable.
			</p>
			<p className="setting-item-description">
				Enter comma-separated property names (e.g., status, priority, project, tags). Only properties that exist in the
				note's frontmatter are displayed.
			</p>
		</div>
	);
});
