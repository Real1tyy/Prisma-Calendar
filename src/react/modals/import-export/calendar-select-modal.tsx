import { ModalSchemaForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { TIMEZONE_LABELS } from "../../../components/settings/integration-shared";
import { tid } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { ExportOptions } from "../../../core/integrations/ics-export";

const CalendarSelectSchema = z.object({
	calendar: z.string().min(1).default("").meta({ title: "Calendar" }),
	timezone: z.string().min(1).default("UTC").meta({ title: "Timezone" }),
	excludeSkipped: z.boolean().default(true).meta({ title: "Exclude skipped events" }),
});

type CalendarSelectValues = z.infer<typeof CalendarSelectSchema>;

interface CalendarSelectFormProps {
	calendars: CalendarBundle[];
	onSubmit: (values: CalendarSelectValues) => void;
	onCancel: () => void;
}

function CalendarSelectForm({ calendars, onSubmit, onCancel }: CalendarSelectFormProps) {
	const form = useZodForm({
		schema: CalendarSelectSchema,
		defaultValues: { calendar: calendars[0]?.calendarId ?? "" },
	});

	const excludeSkipped = useWatch({ control: form.control, name: "excludeSkipped" });

	const calendarOptions = useMemo(
		() =>
			Object.fromEntries(
				calendars.map((b) => {
					const allEvents = b.eventStore.getAllEvents();
					const count = excludeSkipped ? allEvents.filter((e) => !e.skipped).length : allEvents.length;
					return [b.calendarId, `${b.settingsStore.currentSettings.name} (${count} events)`];
				})
			),
		[calendars, excludeSkipped]
	);

	return (
		<ModalSchemaForm
			form={form}
			onSubmit={onSubmit}
			onCancel={onCancel}
			submitLabel="Export"
			submitTestId={tid("ics-export-submit")}
			cancelTestId={tid("ics-export-cancel")}
		>
			<SchemaForm
				form={form}
				schema={CalendarSelectSchema}
				fieldOverrides={{
					calendar: { options: calendarOptions },
					timezone: { options: TIMEZONE_LABELS },
				}}
				testIdPrefix={tid("ics-export-")}
			/>
		</ModalSchemaForm>
	);
}

export function openCalendarSelectModal(app: App, calendars: CalendarBundle[]): Promise<ExportOptions | null> {
	return openReactModal<ExportOptions>({
		app,
		title: "Export calendar",
		testId: tid("modal-calendar-select"),
		render: (submit, cancel) => (
			<CalendarSelectForm
				calendars={calendars}
				onSubmit={(values) => {
					const bundle = calendars.find((b) => b.calendarId === values.calendar);
					if (!bundle) return;
					submit({ bundle, timezone: values.timezone, excludeSkipped: values.excludeSkipped });
				}}
				onCancel={cancel}
			/>
		),
	});
}
