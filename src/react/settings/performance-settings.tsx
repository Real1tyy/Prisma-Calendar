import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { PrismaSection } from "./_section";

interface PerformanceSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const FIELDS = ["enableNameSeriesTracking", "fileConcurrencyLimit"];

export const PerformanceSettingsReact = memo(function PerformanceSettingsReact({
	settingsStore,
}: PerformanceSettingsProps) {
	return (
		<PrismaSection
			store={settingsStore}
			shape={SingleCalendarConfigSchema.shape}
			heading="Performance"
			fields={FIELDS}
		/>
	);
});
