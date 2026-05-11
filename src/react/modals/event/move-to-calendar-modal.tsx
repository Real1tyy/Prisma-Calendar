import { ModalSchemaForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useMemo } from "react";
import { z } from "zod";

import type { CalendarBundle } from "../../../core/calendar-bundle";

const MoveToCalendarSchema = z.object({
	calendarId: z.string().min(1).default("").meta({ title: "Destination planning system" }),
});

type MoveToCalendarValues = z.infer<typeof MoveToCalendarSchema>;

export interface MoveToCalendarOption {
	calendarId: string;
	name: string;
	directory: string;
}

interface MoveToCalendarFormProps {
	options: MoveToCalendarOption[];
	onSubmit: (calendarId: string) => void;
	onCancel: () => void;
}

function MoveToCalendarForm({ options, onSubmit, onCancel }: MoveToCalendarFormProps) {
	const form = useZodForm({
		schema: MoveToCalendarSchema,
		defaultValues: { calendarId: options[0]?.calendarId ?? "" },
	});

	const calendarOptions = useMemo(
		() => Object.fromEntries(options.map((o) => [o.calendarId, `${o.name} (${o.directory || "/"})`])),
		[options]
	);

	return (
		<ModalSchemaForm
			form={form}
			onSubmit={(values: MoveToCalendarValues) => onSubmit(values.calendarId)}
			onCancel={onCancel}
			submitLabel="Move"
			submitTestId="prisma-move-to-calendar-submit"
			cancelTestId="prisma-move-to-calendar-cancel"
		>
			<SchemaForm
				form={form}
				schema={MoveToCalendarSchema}
				fieldOverrides={{
					calendarId: { options: calendarOptions },
				}}
				testIdPrefix="prisma-move-to-calendar-"
			/>
		</ModalSchemaForm>
	);
}

export function openMoveToCalendarModal(
	app: App,
	currentCalendarId: string,
	calendars: CalendarBundle[]
): Promise<string | null> {
	const eligible: MoveToCalendarOption[] = calendars
		.filter((b) => b.calendarId !== currentCalendarId)
		.map((b) => ({
			calendarId: b.calendarId,
			name: b.settingsStore.currentSettings.name,
			directory: b.settingsStore.currentSettings.directory,
		}));

	if (eligible.length === 0) return Promise.resolve(null);

	return openReactModal<string>({
		app,
		title: "Move event to planning system",
		testId: "prisma-modal-move-to-calendar",
		render: (submit, cancel) => <MoveToCalendarForm options={eligible} onSubmit={submit} onCancel={cancel} />,
	});
}
