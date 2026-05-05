import { ModalForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { TIMEZONE_LABELS } from "../../../components/settings/integration-shared";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { type ICSImportResult, type ImportedEvent, parseICSContent } from "../../../core/integrations/ics-import";

const ImportOptionsSchema = z.object({
	calendar: z.string().min(1).default(""),
	timezone: z.string().min(1).default("UTC"),
});

const MAX_PREVIEW_EVENTS = 10;

export interface ICSImportSelection {
	bundle: CalendarBundle;
	events: ImportedEvent[];
	timezone: string;
}

interface ICSImportFormProps {
	calendars: CalendarBundle[];
	onSubmit: (result: ICSImportSelection) => void;
	onCancel: () => void;
}

const EventPreviewList = memo(function EventPreviewList({ events }: { events: ImportedEvent[] }) {
	const visible = events.slice(0, MAX_PREVIEW_EVENTS);
	const remaining = events.length - visible.length;

	return (
		<div className="prisma-ics-import-preview" data-testid="prisma-ics-import-preview">
			<h4>Found {events.length} events:</h4>
			<ul className="prisma-ics-import-event-list">
				{visible.map((event, i) => (
					<li key={i}>
						<strong>{event.title}</strong>
						<span>
							{" - "}
							{event.allDay ? event.start.toLocaleDateString() : event.start.toLocaleString()}
						</span>
					</li>
				))}
				{remaining > 0 && <li className="prisma-ics-import-more">... and {remaining} more</li>}
			</ul>
		</div>
	);
});

function ICSImportForm({ calendars, onSubmit, onCancel }: ICSImportFormProps) {
	const [parsedEvents, setParsedEvents] = useState<ImportedEvent[]>([]);
	const [parseError, setParseError] = useState<string | null>(null);
	const [fileSelected, setFileSelected] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const form = useZodForm({
		schema: ImportOptionsSchema,
		defaultValues: { calendar: calendars[0]?.calendarId ?? "" },
	});

	const calendarOptions = useMemo(
		() => Object.fromEntries(calendars.map((b) => [b.calendarId, b.settingsStore.currentSettings.name])),
		[calendars]
	);
	const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setFileSelected(true);

		void file
			.text()
			.then((content) => {
				const result: ICSImportResult = parseICSContent(content);
				if (!result.success) {
					setParseError(result.error?.message || "Failed to parse ICS file");
					setParsedEvents([]);
					return;
				}
				setParsedEvents(result.events);
				setParseError(null);
			})
			.catch((error) => {
				setParseError(error instanceof Error ? error.message : "Failed to read file");
				setParsedEvents([]);
			});
	}, []);

	const handleSubmit = useCallback(() => {
		void form.handleSubmit((values) => {
			const selectedBundle = calendars.find((b) => b.calendarId === values.calendar);
			if (!selectedBundle || parsedEvents.length === 0) {
				new Notice("Please select a file and calendar");
				return;
			}
			onSubmit({ bundle: selectedBundle, events: parsedEvents, timezone: values.timezone });
		})();
	}, [form, calendars, parsedEvents, onSubmit]);

	const canSubmit = parsedEvents.length > 0 && !parseError;

	return (
		<ModalForm
			onSubmit={handleSubmit}
			onCancel={onCancel}
			submitLabel="Import"
			submitDisabled={!canSubmit}
			submitTestId="prisma-ics-import-submit"
			cancelTestId="prisma-ics-import-cancel"
		>
			<h2>Import .ics file</h2>
			<div className="prisma-ics-import-form">
				<div className="prisma-ics-import-section">
					<label>Select .ics file</label>
					<input
						ref={fileInputRef}
						type="file"
						accept=".ics,.ical"
						onChange={handleFileChange}
						data-testid="prisma-ics-import-file"
					/>
				</div>

				<SchemaForm
					form={form}
					schema={ImportOptionsSchema}
					fieldOverrides={{
						calendar: { label: "Import to calendar", options: calendarOptions },
						timezone: { label: "Timezone", options: TIMEZONE_LABELS },
					}}
					testIdPrefix="prisma-ics-import-"
				/>

				{!fileSelected && (
					<div className="prisma-ics-import-preview">
						<p className="prisma-ics-import-preview-placeholder">Select an .ics file to preview events</p>
					</div>
				)}
				{parseError && (
					<div className="prisma-ics-import-preview">
						<p className="prisma-ics-import-error">Error: {parseError}</p>
					</div>
				)}
				{parsedEvents.length > 0 && <EventPreviewList events={parsedEvents} />}
				{fileSelected && parsedEvents.length === 0 && !parseError && (
					<div className="prisma-ics-import-preview">
						<p>No events found in file</p>
					</div>
				)}
			</div>
		</ModalForm>
	);
}

export function openICSImportModal(app: App, calendars: CalendarBundle[]): Promise<ICSImportSelection | null> {
	return openReactModal<ICSImportSelection>({
		app,
		cls: "prisma-ics-import-modal",
		testId: "prisma-modal-ics-import",
		render: (submit, cancel) => <ICSImportForm calendars={calendars} onSubmit={submit} onCancel={cancel} />,
	});
}
