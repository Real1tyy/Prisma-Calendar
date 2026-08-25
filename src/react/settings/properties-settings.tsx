import { introspectShape, mergePropertyOrder, toSafeString } from "@real1ty/obsidian-plugins";
import {
	Button,
	PropertyOrderTable,
	SettingHeading,
	SettingItem,
	useSettingsStore,
	type PropertyOrderEntry,
} from "@real1ty/obsidian-plugins-react";
import { memo, useCallback, useMemo } from "react";

import { cls, tid } from "../../constants";
import { runNormalizePropertyOrder } from "../../core/api/normalize-property-order";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import { DEFAULT_PROPERTY_ORDER } from "../../types/event-metadata";
import { SingleCalendarConfigSchema, type SingleCalendarConfig } from "../../types/settings";
import { DISPLAY_FIELDS } from "../../utils/calendar/settings";
import { PrismaSection } from "./_section";

interface PropertiesSettingsProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
}

const propLabel = (descriptor: { label: string }): string => descriptor.label.replace(/ Prop$/, " property");

const SHAPE = SingleCalendarConfigSchema.shape;

const STATUS_VALUE_FIELDS = ["doneValue", "notDoneValue", "customDoneProperty", "customUndoneProperty"] as const;

export const PropertiesSettingsReact = memo(function PropertiesSettingsReact({
	settingsStore,
	plugin,
}: PropertiesSettingsProps) {
	const [settings, updateSettings] = useSettingsStore(settingsStore);

	const descriptorsByKey = useMemo(() => new Map(introspectShape(SHAPE).map((d) => [d.key, d])), []);

	const entries = useMemo<PropertyOrderEntry[]>(() => {
		const orderedKeys = mergePropertyOrder(settings.propertyOrder ?? [], DEFAULT_PROPERTY_ORDER);
		return orderedKeys.map((key) => {
			const descriptor = descriptorsByKey.get(key);
			return {
				key,
				label: descriptor ? propLabel(descriptor) : key,
				description: descriptor?.description,
				name: toSafeString(settings[key as keyof SingleCalendarConfig]) ?? "",
				placeholder: descriptor?.placeholder,
			};
		});
	}, [settings, descriptorsByKey]);

	const handleReorder = useCallback(
		(orderedKeys: string[]) => void updateSettings((s) => ({ ...s, propertyOrder: orderedKeys })),
		[updateSettings]
	);

	const handleRename = useCallback(
		(key: string, name: string) => void updateSettings((s) => ({ ...s, [key]: name })),
		[updateSettings]
	);

	const propSection = (heading: string, fields: readonly string[]) => (
		<PrismaSection store={settingsStore} shape={SHAPE} heading={heading} fields={fields} labelTransform={propLabel} />
	);

	return (
		<>
			<SettingHeading name="Properties" />
			<PropertyOrderIntro />
			<PropertyOrderTable entries={entries} onReorder={handleReorder} onRename={handleRename} />
			<SettingItem
				name="Normalize property order"
				description="Scan every event file for Prisma properties out of the order above, review the list, and rewrite them in one pass with a progress bar. Run it on one device and let sync propagate."
				testId={tid("settings-normalize-property-order")}
			>
				<Button
					variant="primary"
					onClick={() => void runNormalizePropertyOrder(plugin)}
					testId={tid("settings-normalize-property-order-button")}
				>
					Scan and normalize…
				</Button>
			</SettingItem>
			{propSection("Sorting", ["sortingStrategy"])}
			<EventTypesInfo settings={settings} />
			<RecurringEventsInfo settings={settings} />
			{propSection("Status values", STATUS_VALUE_FIELDS)}
			<FrontmatterDisplayIntro />
			<PrismaSection store={settingsStore} shape={SHAPE} heading="Display in events" fields={DISPLAY_FIELDS} />
		</>
	);
});

const PropertyOrderIntro = memo(function PropertyOrderIntro() {
	return (
		<div className={cls("settings-info-box")}>
			<p>
				Rename any property and arrange the rows — drag a row or use the arrows. The row order is the exact frontmatter
				order Prisma writes to disk: on every save, Prisma's own properties are regrouped into this order (other
				properties are never touched), so files stay byte-identical across synced devices and sync conflicts caused by
				shuffled property order disappear.
			</p>
			<p className="setting-item-description">
				Existing files pick up the order the next time Prisma writes to them. To apply it everywhere right away —
				whether you're fixing sync conflicts or just setting the baseline for a new order — press "Scan and normalize…"
				below or run the "Normalize property order" command, on one device, and let sync propagate.
			</p>
		</div>
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
