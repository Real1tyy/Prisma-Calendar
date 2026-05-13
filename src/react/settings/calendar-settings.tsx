import { Dropdown, SettingItem, useSchemaField } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { FIRST_DAY_OPTIONS } from "../../types/index";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { PrismaSection } from "./_section";

interface CalendarSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const VIEW_FIELDS = ["defaultView", "defaultMobileView", "hideWeekends", "density"];

const APPEARANCE_FIELDS = [
	"enableEventPreview",
	"skipUnderscoreProperties",
	"showDurationInTitle",
	"highlightUpcomingEvent",
	"nowIndicator",
	"thickerHourLines",
	"pastEventContrast",
];

const LAYOUT_FIELDS = ["stickyDayHeaders", "stickyAllDayEvents", "allDayEventHeight"];

const TIME_GRID_FIELDS = [
	"hourStart",
	"hourEnd",
	"slotDurationMinutes",
	"snapDurationMinutes",
	"dragEdgeScrollDelayMs",
	"zoomLevels",
];

const OVERLAP_FIELDS = [
	"eventOverlap",
	"slotEventOverlap",
	"eventMaxStack",
	"desktopMaxEventsPerDay",
	"mobileMaxEventsPerDay",
	"showColorDots",
];

const STEP_OVERRIDES = {
	allDayEventHeight: { step: 5 },
	dragEdgeScrollDelayMs: { step: 50 },
};

export const CalendarSettingsReact = memo(function CalendarSettingsReact({ settingsStore }: CalendarSettingsProps) {
	const shape = SingleCalendarConfigSchema.shape;
	const section = (heading: string, fields: string[], overrides?: typeof STEP_OVERRIDES) => (
		<PrismaSection
			store={settingsStore}
			shape={shape}
			heading={heading}
			fields={fields}
			{...(overrides ? { overrides } : {})}
		/>
	);
	return (
		<>
			{section("Views", VIEW_FIELDS)}
			<DayCellColoringSection settingsStore={settingsStore} />
			{section("Event appearance", APPEARANCE_FIELDS)}
			{section("Sticky & layout", LAYOUT_FIELDS, STEP_OVERRIDES)}
			{section("Time grid", TIME_GRID_FIELDS, STEP_OVERRIDES)}
			<FirstDayOfWeekField settingsStore={settingsStore} />
			{section("Event overlap", OVERLAP_FIELDS)}
			{section("Event text colors", ["eventTextColor", "eventTextColorAlt"])}
			{section("Capacity tracking", ["capacityTrackingEnabled"])}
			{section("Prerequisite arrows", ["connectionColor", "connectionStrokeWidth", "connectionArrowSize"])}
		</>
	);
});

const FIRST_DAY_STRING_OPTIONS: Record<string, string> = Object.fromEntries(
	Object.entries(FIRST_DAY_OPTIONS).map(([num, label]) => [num, label])
);

const FirstDayOfWeekField = memo(function FirstDayOfWeekField({ settingsStore }: CalendarSettingsProps) {
	const [firstDay, setFirstDay] = useSchemaField(settingsStore, "firstDayOfWeek");
	const handleChange = useCallback(
		(raw: string) => {
			const n = Number.parseInt(raw, 10);
			if (Number.isInteger(n) && n >= 0 && n <= 6) {
				setFirstDay(n);
			}
		},
		[setFirstDay]
	);
	return (
		<SettingItem name="First day of week" description="Which day should be the first day of the week in calendar views">
			<Dropdown value={String(firstDay)} options={FIRST_DAY_STRING_OPTIONS} onChange={handleChange} />
		</SettingItem>
	);
});

const DayCellColoringSection = memo(function DayCellColoringSection({ settingsStore }: CalendarSettingsProps) {
	const shape = SingleCalendarConfigSchema.shape;
	const [mode] = useSchemaField(settingsStore, "dayCellColoring");

	return (
		<>
			<PrismaSection store={settingsStore} shape={shape} fields={["dayCellColoring"]} />
			{mode === "uniform" && (
				<PrismaSection
					store={settingsStore}
					shape={shape}
					fields={["monthEvenColor"]}
					overrides={{
						monthEvenColor: {
							label: "Day background color",
							description: "Gradient color applied uniformly to all day cells in every view",
						},
					}}
				/>
			)}
			{mode === "boundary" && (
				<PrismaSection
					store={settingsStore}
					shape={shape}
					fields={["monthEvenColor", "monthOddColor"]}
					overrides={{
						monthEvenColor: {
							label: "Even month color",
							description: "Gradient color for even months (January, March, May, July, September, November)",
						},
						monthOddColor: {
							label: "Odd month color",
							description: "Gradient color for odd months (February, April, June, August, October, December)",
						},
					}}
				/>
			)}
		</>
	);
});
