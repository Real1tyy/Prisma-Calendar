import { memo } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { PrismaSection } from "./_section";

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
	return <PrismaSection store={settingsStore} shape={SHAPE} heading="Notifications" fields={FIELDS} />;
});
