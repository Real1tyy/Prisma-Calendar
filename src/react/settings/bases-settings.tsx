import { SchemaSection } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

interface BasesSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const FIELDS = ["basesViewType", "basesViewProperties"];

const OVERRIDES = {
	basesViewType: {
		label: "View type",
		options: {
			cards: "Cards (Recommended)",
			table: "Table",
			list: "List",
		},
	},
	basesViewProperties: {
		label: "Additional properties",
		placeholder: "priority, project, tags",
	},
};

export const BasesSettingsReact = memo(function BasesSettingsReact({ settingsStore }: BasesSettingsProps) {
	return (
		<SchemaSection
			store={settingsStore}
			shape={SingleCalendarConfigSchema.shape}
			heading="Bases"
			fields={FIELDS}
			overrides={OVERRIDES}
		/>
	);
});
