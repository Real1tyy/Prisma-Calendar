import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { PrismaSection } from "./_section";

interface BasesSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const FIELDS = ["basesViewType", "basesViewProperties"];

export const BasesSettingsReact = memo(function BasesSettingsReact({ settingsStore }: BasesSettingsProps) {
	return (
		<PrismaSection store={settingsStore} shape={SingleCalendarConfigSchema.shape} heading="Bases" fields={FIELDS} />
	);
});
