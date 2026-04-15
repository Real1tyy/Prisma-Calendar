import { SchemaSection } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

interface PerformanceSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const FIELDS = ["enableNameSeriesTracking", "fileConcurrencyLimit"];

export const PerformanceSettingsReact = memo(function PerformanceSettingsReact({
	settingsStore,
}: PerformanceSettingsProps) {
	return (
		<SchemaSection
			store={settingsStore}
			shape={SingleCalendarConfigSchema.shape}
			heading="Performance"
			fields={FIELDS}
			testIdPrefix="prisma-settings-"
		/>
	);
});
