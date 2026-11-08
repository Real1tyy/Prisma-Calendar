import { ModalSchemaForm, openReactModal, SchemaForm, useZodForm } from "@real1ty/obsidian-plugins-react";
import type { App } from "obsidian";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { EventFilterFormFields, TIMEZONE_LABELS } from "../../../components/settings/integration-shared";
import { cls, tid } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { selectEventsForExport, type ExportOptions } from "../../../core/integrations/ics-export";
import type { FilterPreset } from "../../../types/settings";
import { filterPresetFieldOverride } from "../filter-preset-field";

const CalendarSelectSchema = z.object({
	calendar: z.string().min(1).default("").meta({ title: "Calendar" }),
	timezone: z.string().min(1).default("UTC").meta({ title: "Timezone" }),
	excludeSkipped: z.boolean().default(true).meta({ title: "Exclude skipped events" }),
	...EventFilterFormFields,
});

type CalendarSelectValues = z.infer<typeof CalendarSelectSchema>;

// Stable identity so the preset dropdown's options memo doesn't churn.
const NO_PRESETS: FilterPreset[] = [];

interface CalendarSelectFormProps {
	calendars: CalendarBundle[];
	onSubmit: (values: CalendarSelectValues) => void;
	onCancel: () => void;
}

function countExportable(bundle: CalendarBundle, excludeSkipped: boolean, filterExpression: string): number | Error {
	try {
		return selectEventsForExport(bundle.eventStore.getAllEvents(), { excludeSkipped, filterExpression }).length;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}
}

function CalendarSelectForm({ calendars, onSubmit, onCancel }: CalendarSelectFormProps) {
	const form = useZodForm({
		schema: CalendarSelectSchema,
		defaultValues: { ...CalendarSelectSchema.parse({}), calendar: calendars[0]?.calendarId ?? "" },
	});

	const [calendarId, excludeSkipped, filterExpression] = useWatch({
		control: form.control,
		name: ["calendar", "excludeSkipped", "filterExpression"],
	});

	const selectedBundle = calendars.find((b) => b.calendarId === calendarId);
	const filterPresets = selectedBundle?.settingsStore.currentSettings.filterPresets ?? NO_PRESETS;

	const counts = useMemo(
		() => new Map(calendars.map((b) => [b.calendarId, countExportable(b, excludeSkipped, filterExpression)])),
		[calendars, excludeSkipped, filterExpression]
	);

	const calendarOptions = useMemo(
		() =>
			Object.fromEntries(
				calendars.map((b) => {
					const count = counts.get(b.calendarId);
					const suffix = count instanceof Error ? "invalid filter" : `${count} events`;
					return [b.calendarId, `${b.settingsStore.currentSettings.name} (${suffix})`];
				})
			),
		[calendars, counts]
	);

	const selectedCount = counts.get(calendarId);
	const filterError = selectedCount instanceof Error ? selectedCount.message : null;

	return (
		<ModalSchemaForm
			form={form}
			onSubmit={onSubmit}
			onCancel={onCancel}
			submitLabel="Export"
			submitDisabled={filterError !== null}
			submitTestId={tid("ics-export-submit")}
			cancelTestId={tid("ics-export-cancel")}
		>
			<SchemaForm
				form={form}
				schema={CalendarSelectSchema}
				fieldOverrides={{
					calendar: { options: calendarOptions },
					timezone: { options: TIMEZONE_LABELS },
					filterPreset: filterPresetFieldOverride(filterPresets, tid("ics-export-control-filterPreset")),
				}}
				testIdPrefix={tid("ics-export-")}
			/>
			{filterError && (
				<p className={cls("ics-import-error")} data-testid={tid("ics-export-filter-error")}>
					{filterError}
				</p>
			)}
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
					submit({
						bundle,
						timezone: values.timezone,
						excludeSkipped: values.excludeSkipped,
						filterExpression: values.filterExpression,
					});
				}}
				onCancel={cancel}
			/>
		),
	});
}
