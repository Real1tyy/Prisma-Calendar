import { showSchemaFormModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { z } from "zod";

import { CSS_PREFIX } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { COMMON_TIMEZONES, type ExportOptions } from "../../../core/integrations/ics-export";

const CalendarSelectShape = {
	calendar: z.string().min(1),
	timezone: z.string().min(1),
	excludeSkipped: z.boolean(),
};

export function showCalendarSelectModal(
	app: App,
	calendars: CalendarBundle[],
	onSelect: (options: ExportOptions) => void
): void {
	showSchemaFormModal({
		app,
		prefix: CSS_PREFIX,
		title: "Export calendar",
		shape: CalendarSelectShape,
		submitText: "Export",
		submitTestId: "prisma-ics-export-submit",
		cancelTestId: "prisma-ics-export-cancel",
		existing: {
			calendar: calendars[0]?.calendarId ?? "",
			timezone: "UTC",
			excludeSkipped: true,
		},
		fieldOverrides: {
			calendar: {
				label: "Calendar",
				options: calendars.map((b) => ({
					value: b.calendarId,
					label: `${b.settingsStore.currentSettings.name} (${b.eventStore.getAllEvents().length} events)`,
				})),
			},
			timezone: {
				label: "Timezone",
				options: COMMON_TIMEZONES.map((tz) => ({ value: tz.id, label: tz.label })),
			},
			excludeSkipped: { label: "Exclude skipped events" },
		},
		onSubmit: (values) => {
			const bundle = calendars.find((b) => b.calendarId === values.calendar);
			if (!bundle) return;
			onSelect({ bundle, timezone: values.timezone, excludeSkipped: values.excludeSkipped });
		},
	});
}
