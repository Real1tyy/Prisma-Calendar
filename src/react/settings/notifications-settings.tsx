import { SchemaSection } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

interface NotificationsSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const FIELDS = [
	"enableNotifications",
	"notificationSound",
	"skipNewlyCreatedNotifications",
	"snoozeMinutes",
	"defaultMinutesBefore",
	"defaultDaysBefore",
];

const SHAPE = SingleCalendarConfigSchema.shape;

export const NotificationsSettingsReact = memo(function NotificationsSettingsReact({
	settingsStore,
}: NotificationsSettingsProps) {
	return (
		<SchemaSection
			store={settingsStore}
			shape={SHAPE}
			heading="Notifications"
			fields={FIELDS}
			testIdPrefix="prisma-settings-"
		/>
	);
});
