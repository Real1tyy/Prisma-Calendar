import { Dropdown, SchemaSection, SettingItem, useSchemaField } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { FIRST_DAY_OPTIONS } from "../../types/index";
import { SingleCalendarConfigSchema } from "../../types/settings";

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
	return (
		<>
			<SchemaSection store={settingsStore} shape={shape} heading="Views" fields={VIEW_FIELDS} />

			<DayCellColoringSection settingsStore={settingsStore} />

			<SchemaSection store={settingsStore} shape={shape} heading="Event appearance" fields={APPEARANCE_FIELDS} />

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Sticky & layout"
				fields={LAYOUT_FIELDS}
				overrides={STEP_OVERRIDES}
			/>

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Time grid"
				fields={TIME_GRID_FIELDS}
				overrides={STEP_OVERRIDES}
			/>
			<FirstDayOfWeekField settingsStore={settingsStore} />

			<SchemaSection store={settingsStore} shape={shape} heading="Event overlap" fields={OVERLAP_FIELDS} />

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Event text colors"
				fields={["eventTextColor", "eventTextColorAlt"]}
			/>

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Capacity tracking"
				fields={["capacityTrackingEnabled"]}
			/>

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Prerequisite arrows"
				fields={["connectionColor", "connectionStrokeWidth", "connectionArrowSize"]}
			/>
		</>
	);
});

const FIRST_DAY_STRING_OPTIONS: Record<string, string> = Object.fromEntries(
	Object.entries(FIRST_DAY_OPTIONS).map(([num, label]) => [num, label])
);

const FirstDayOfWeekField = memo(function FirstDayOfWeekField({ settingsStore }: CalendarSettingsProps) {
	const binding = useSchemaField<number>(settingsStore, "firstDayOfWeek");
	const handleChange = useCallback(
		(raw: string) => {
			const n = Number.parseInt(raw, 10);
			if (Number.isInteger(n) && n >= 0 && n <= 6) {
				binding.onChange(n);
			}
		},
		[binding]
	);
	return (
		<SettingItem name="First day of week" description="Which day should be the first day of the week in calendar views">
			<Dropdown value={String(binding.value)} options={FIRST_DAY_STRING_OPTIONS} onChange={handleChange} />
		</SettingItem>
	);
});

const DayCellColoringSection = memo(function DayCellColoringSection({ settingsStore }: CalendarSettingsProps) {
	const shape = SingleCalendarConfigSchema.shape;
	const mode = useSchemaField<"off" | "uniform" | "boundary">(settingsStore, "dayCellColoring");

	return (
		<>
			<SchemaSection store={settingsStore} shape={shape} fields={["dayCellColoring"]} />
			{mode.value === "uniform" && (
				<SchemaSection
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
			{mode.value === "boundary" && (
				<SchemaSection
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
