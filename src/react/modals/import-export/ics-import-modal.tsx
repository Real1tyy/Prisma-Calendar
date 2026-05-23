import { describeError } from "@real1ty-obsidian-plugins";
import { ModalForm, openReactModal, SchemaForm, useZodForm } from "@real1ty-obsidian-plugins-react";
import { Notice, type App } from "obsidian";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { TIMEZONE_LABELS } from "../../../components/settings/integration-shared";
import { cls, tid } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import {
	parseICSContent,
	type ICSImportResult,
	type ImportedEvent,
	type SkippedEvent,
} from "../../../core/integrations/ics-import";

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

const MAX_SKIPPED_DETAILS = 5;

const SkippedEventsWarning = memo(function SkippedEventsWarning({ skipped }: { skipped: SkippedEvent[] }) {
	const visible = skipped.slice(0, MAX_SKIPPED_DETAILS);
	const remaining = skipped.length - visible.length;

	return (
		<div className={cls("ics-import-preview")} data-testid={tid("ics-import-skipped")}>
			<p className={cls("ics-import-error")}>
				{skipped.length} event{skipped.length !== 1 ? "s" : ""} will be skipped because{" "}
				{skipped.length === 1 ? "it" : "they"} could not be parsed:
			</p>
			<ul className={cls("ics-import-event-list")}>
				{visible.map((s) => (
					<li key={s.index}>
						<strong>#{s.index}</strong>
						{s.summary ? ` "${s.summary}"` : ""}
						{" — "}
						<span>{s.error.message}</span>
					</li>
				))}
				{remaining > 0 && <li className={cls("ics-import-more")}>... and {remaining} more (see console)</li>}
			</ul>
		</div>
	);
});

const EventPreviewList = memo(function EventPreviewList({ events }: { events: ImportedEvent[] }) {
	const visible = events.slice(0, MAX_PREVIEW_EVENTS);
	const remaining = events.length - visible.length;

	return (
		<div className={cls("ics-import-preview")} data-testid={tid("ics-import-preview")}>
			<h4>Found {events.length} events:</h4>
			<ul className={cls("ics-import-event-list")}>
				{visible.map((event) => (
					<li key={event.uid}>
						<strong>{event.title}</strong>
						<span>
							{" - "}
							{event.allDay ? event.start.toLocaleDateString() : event.start.toLocaleString()}
						</span>
					</li>
				))}
				{remaining > 0 && <li className={cls("ics-import-more")}>... and {remaining} more</li>}
			</ul>
		</div>
	);
});

function ICSImportForm({ calendars, onSubmit, onCancel }: ICSImportFormProps) {
	const [parsedEvents, setParsedEvents] = useState<ImportedEvent[]>([]);
	const [skippedEvents, setSkippedEvents] = useState<SkippedEvent[]>([]);
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
					setSkippedEvents([]);
					return;
				}
				setParsedEvents(result.events);
				setSkippedEvents(result.skipped);
				setParseError(null);
			})
			.catch((error: unknown) => {
				setParseError(describeError(error, "Failed to read file"));
				setParsedEvents([]);
				setSkippedEvents([]);
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
			submitTestId={tid("ics-import-submit")}
			cancelTestId={tid("ics-import-cancel")}
		>
			<h2>Import .ics file</h2>
			<div className={cls("ics-import-form")}>
				<div className={cls("ics-import-section")}>
					<label>Select .ics file</label>
					<input
						ref={fileInputRef}
						type="file"
						accept=".ics,.ical"
						onChange={handleFileChange}
						data-testid={tid("ics-import-file")}
					/>
				</div>

				<SchemaForm
					form={form}
					schema={ImportOptionsSchema}
					fieldOverrides={{
						calendar: { label: "Import to calendar", options: calendarOptions },
						timezone: { label: "Timezone", options: TIMEZONE_LABELS },
					}}
					testIdPrefix={tid("ics-import-")}
				/>

				{!fileSelected && (
					<div className={cls("ics-import-preview")}>
						<p className={cls("ics-import-preview-placeholder")}>Select an .ics file to preview events</p>
					</div>
				)}
				{parseError && (
					<div className={cls("ics-import-preview")}>
						<p className={cls("ics-import-error")}>Error: {parseError}</p>
					</div>
				)}
				{skippedEvents.length > 0 && <SkippedEventsWarning skipped={skippedEvents} />}
				{parsedEvents.length > 0 && <EventPreviewList events={parsedEvents} />}
				{fileSelected && parsedEvents.length === 0 && !parseError && (
					<div className={cls("ics-import-preview")}>
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
		cls: cls("ics-import-modal"),
		testId: tid("modal-ics-import"),
		render: (submit, cancel) => <ICSImportForm calendars={calendars} onSubmit={submit} onCancel={cancel} />,
	});
}
