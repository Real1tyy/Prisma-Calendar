import { Dropdown, SchemaSection, SettingItem, useSchemaField } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import {
	CALENDAR_VIEW_OPTIONS,
	DAY_CELL_COLORING_OPTIONS,
	DENSITY_OPTIONS,
	FIRST_DAY_OPTIONS,
} from "../../types/index";
import { SingleCalendarConfigSchema } from "../../types/settings";

interface CalendarSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const UI_FIELDS = [
	"defaultView",
	"defaultMobileView",
	"hideWeekends",
	"enableEventPreview",
	"skipUnderscoreProperties",
	"nowIndicator",
	"highlightUpcomingEvent",
	"thickerHourLines",
];

const AFTER_COLORING_FIELDS = [
	"showDurationInTitle",
	"stickyDayHeaders",
	"stickyAllDayEvents",
	"allDayEventHeight",
	"pastEventContrast",
];

const HOUR_FIELDS = ["hourStart", "hourEnd", "slotDurationMinutes", "snapDurationMinutes", "dragEdgeScrollDelayMs"];

const OVERLAP_FIELDS = [
	"eventOverlap",
	"slotEventOverlap",
	"eventMaxStack",
	"desktopMaxEventsPerDay",
	"mobileMaxEventsPerDay",
];

const UI_OVERRIDES = {
	defaultView: {
		label: "Default view",
		description: "The calendar view to show when opening",
		options: CALENDAR_VIEW_OPTIONS as unknown as Record<string, string>,
	},
	defaultMobileView: {
		label: "Default mobile view",
		description: "The calendar view to show when opening on mobile devices (screen width ≤ 768px)",
		options: CALENDAR_VIEW_OPTIONS as unknown as Record<string, string>,
	},
	nowIndicator: { label: "Show current time indicator" },
};

const AFTER_COLORING_OVERRIDES = {
	showDurationInTitle: { label: "Show duration in event title" },
	allDayEventHeight: { step: 5 },
};

const HOUR_OVERRIDES = {
	hourStart: { label: "Day start hour" },
	hourEnd: { label: "Day end hour" },
	dragEdgeScrollDelayMs: { step: 50 },
};

const OVERLAP_OVERRIDES = {
	eventOverlap: { label: "Allow event overlap" },
	slotEventOverlap: { label: "Allow slot event overlap" },
	eventMaxStack: { label: "Event stack limit" },
	desktopMaxEventsPerDay: { label: "Desktop events per day" },
	mobileMaxEventsPerDay: { label: "Mobile events per day" },
};

const TEXT_COLOR_OVERRIDES = {
	eventTextColor: {
		label: "Default event text color",
		description: "Text color for events with dark backgrounds (default: white)",
	},
	eventTextColorAlt: {
		label: "Alternative event text color",
		description: "Text color used when event background is light or white (e.g., pastel colors) for better contrast",
	},
};

const CONNECTION_OVERRIDES = {
	connectionColor: {
		label: "Arrow color",
		description: "Color of the prerequisite connection arrows on the Calendar tab",
	},
	connectionStrokeWidth: { label: "Line thickness" },
	connectionArrowSize: { label: "Arrowhead size" },
};

const CAPACITY_OVERRIDES = {
	capacityTrackingEnabled: { label: "Enable capacity tracking" },
};

const ZOOM_OVERRIDES = {
	zoomLevels: {
		label: "Zoom levels (minutes)",
		description: "Available zoom levels for Ctrl+scroll zooming. Enter comma-separated values (1-60 minutes each)",
		placeholder: "5, 10, 15, 30, 60",
	},
};

const DENSITY_OVERRIDES = {
	density: {
		label: "Display density",
		description: "How compact to make the calendar display",
		options: DENSITY_OPTIONS,
	},
};

export const CalendarSettingsReact = memo(function CalendarSettingsReact({ settingsStore }: CalendarSettingsProps) {
	const shape = SingleCalendarConfigSchema.shape;
	return (
		<>
			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="User interface"
				fields={UI_FIELDS}
				overrides={UI_OVERRIDES}
			/>

			<DayCellColoringSection settingsStore={settingsStore} />

			<SchemaSection
				store={settingsStore}
				shape={shape}
				fields={AFTER_COLORING_FIELDS}
				overrides={AFTER_COLORING_OVERRIDES}
			/>

			<FirstDayOfWeekField settingsStore={settingsStore} />

			<SchemaSection store={settingsStore} shape={shape} fields={HOUR_FIELDS} overrides={HOUR_OVERRIDES} />

			<SchemaSection store={settingsStore} shape={shape} fields={["zoomLevels"]} overrides={ZOOM_OVERRIDES} />

			<SchemaSection store={settingsStore} shape={shape} fields={["density"]} overrides={DENSITY_OVERRIDES} />

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Event overlap"
				fields={OVERLAP_FIELDS}
				overrides={OVERLAP_OVERRIDES}
			/>

			<SchemaSection store={settingsStore} shape={shape} fields={["showColorDots"]} />

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Event text colors"
				fields={["eventTextColor", "eventTextColorAlt"]}
				overrides={TEXT_COLOR_OVERRIDES}
			/>

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Capacity Tracking"
				fields={["capacityTrackingEnabled"]}
				overrides={CAPACITY_OVERRIDES}
			/>

			<SchemaSection
				store={settingsStore}
				shape={shape}
				heading="Prerequisite Connection Arrows"
				fields={["connectionColor", "connectionStrokeWidth", "connectionArrowSize"]}
				overrides={CONNECTION_OVERRIDES}
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
			<Dropdown value={String(binding.value ?? 0)} options={FIRST_DAY_STRING_OPTIONS} onChange={handleChange} />
		</SettingItem>
	);
});

const DayCellColoringSection = memo(function DayCellColoringSection({ settingsStore }: CalendarSettingsProps) {
	const shape = SingleCalendarConfigSchema.shape;
	const mode = useSchemaField<"off" | "uniform" | "boundary">(settingsStore, "dayCellColoring");

	return (
		<>
			<SchemaSection
				store={settingsStore}
				shape={shape}
				fields={["dayCellColoring"]}
				overrides={{
					dayCellColoring: {
						label: "Day cell coloring",
						description:
							"Controls the background coloring of day cells. Off: default calendar appearance. Uniform: applies a single gradient color to all day cells. Month boundary: alternates two gradient colors by even/odd month, making month transitions clearly visible.",
						options: DAY_CELL_COLORING_OPTIONS,
					},
				}}
			/>
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
