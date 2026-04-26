import { MutuallyExclusiveToggles, SchemaSection, SettingHeading } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

interface EventGroupsSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const RECURRING_TOGGLES = {
	toggleA: {
		path: "propagateFrontmatterToInstances",
		name: "Propagate frontmatter to instances",
		description:
			"Automatically propagate frontmatter changes from recurring event sources to all physical instances. When you update custom properties (like category, priority, status) in a source event, all existing instances are updated immediately.",
	},
	toggleB: {
		path: "askBeforePropagatingFrontmatter",
		name: "Ask before propagating",
		description:
			"Show a confirmation modal before propagating frontmatter changes to instances. Allows you to review changes before applying them.",
	},
};

const NAME_SERIES_TOGGLES = {
	toggleA: {
		path: "propagateFrontmatterToNameSeries",
		name: "Propagate frontmatter to name series",
		description:
			"Automatically propagate frontmatter changes across events that share the same title. When you update custom properties on one event, all other events with the same name are updated immediately.",
	},
	toggleB: {
		path: "askBeforePropagatingToNameSeries",
		name: "Ask before propagating to name series",
		description:
			"Show a confirmation modal before propagating frontmatter changes to name series members. Allows you to review changes before applying them.",
	},
};

const CATEGORY_SERIES_TOGGLES = {
	toggleA: {
		path: "propagateFrontmatterToCategorySeries",
		name: "Propagate frontmatter to category series",
		description:
			"Automatically propagate frontmatter changes across events that share the same category. When you update custom properties on one event, all other events with the same category are updated immediately.",
	},
	toggleB: {
		path: "askBeforePropagatingToCategorySeries",
		name: "Ask before propagating to category series",
		description:
			"Show a confirmation modal before propagating frontmatter changes to category series members. Allows you to review changes before applying them.",
	},
};

const MARKERS_FIELDS = [
	"showSourceRecurringMarker",
	"sourceRecurringMarker",
	"showPhysicalRecurringMarker",
	"physicalRecurringMarker",
];

export const EventGroupsSettingsReact = memo(function EventGroupsSettingsReact({
	settingsStore,
}: EventGroupsSettingsProps) {
	const shape = SingleCalendarConfigSchema.shape;
	return (
		<>
			<SchemaSection store={settingsStore} shape={shape} heading="Recurring events" fields={["futureInstancesCount"]} />
			<MutuallyExclusiveToggles store={settingsStore} {...RECURRING_TOGGLES} />
			<SchemaSection store={settingsStore} shape={shape} fields={["excludedRecurringInstanceProps"]} />
			<SchemaSection store={settingsStore} shape={shape} heading="Event markers" fields={MARKERS_FIELDS} />

			<SettingHeading name="Name series propagation" />
			<MutuallyExclusiveToggles store={settingsStore} {...NAME_SERIES_TOGGLES} />
			<SchemaSection store={settingsStore} shape={shape} fields={["excludedNameSeriesProps"]} />

			<SettingHeading name="Category series propagation" />
			<MutuallyExclusiveToggles store={settingsStore} {...CATEGORY_SERIES_TOGGLES} />
			<SchemaSection store={settingsStore} shape={shape} fields={["excludedCategorySeriesProps"]} />
		</>
	);
});
