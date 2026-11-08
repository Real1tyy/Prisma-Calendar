import { describeError } from "@real1ty/obsidian-plugins";
import { ModalForm, openReactModal, SchemaForm, useZodForm } from "@real1ty/obsidian-plugins-react";
import { Notice, type App } from "obsidian";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { EventFilterFormFields, TIMEZONE_LABELS } from "../../../components/settings/integration-shared";
import { cls, tid } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import {
	filterImportedEvents,
	parseICSContent,
	type ICSImportResult,
	type ImportedEvent,
	type SkippedEvent,
} from "../../../core/integrations/ics-import";
import type { FilterPreset } from "../../../types/settings";
import { filterPresetFieldOverride } from "../filter-preset-field";

const ImportOptionsSchema = z.object({
	calendar: z.string().min(1).default(""),
	timezone: z.string().min(1).default("UTC"),
	...EventFilterFormFields,
});

// Stable identity so the preset dropdown's options memo doesn't churn.
const NO_PRESETS: FilterPreset[] = [];

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

const EventPreviewList = memo(function EventPreviewList({
	events,
	totalCount,
}: {
	events: ImportedEvent[];
	totalCount: number;
}) {
	const visible = events.slice(0, MAX_PREVIEW_EVENTS);
	const remaining = events.length - visible.length;

	return (
		<div className={cls("ics-import-preview")} data-testid={tid("ics-import-preview")}>
			<h4 data-testid={tid("ics-import-match-count")}>
				{events.length === totalCount
					? `Found ${totalCount} events:`
					: `${events.length} of ${totalCount} events match the filter:`}
			</h4>
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
		defaultValues: { ...ImportOptionsSchema.parse({}), calendar: calendars[0]?.calendarId ?? "" },
	});

	const calendarOptions = useMemo(
		() => Object.fromEntries(calendars.map((b) => [b.calendarId, b.settingsStore.currentSettings.name])),
		[calendars]
	);

	const [calendarId, timezone, filterExpression] = useWatch({
		control: form.control,
		name: ["calendar", "timezone", "filterExpression"],
	});
	const selectedBundle = calendars.find((b) => b.calendarId === calendarId);
	const filterPresets = selectedBundle?.settingsStore.currentSettings.filterPresets ?? NO_PRESETS;

	const filtered = useMemo((): { events: ImportedEvent[]; error: string | null } => {
		if (!selectedBundle) return { events: parsedEvents, error: null };
		try {
			const settings = selectedBundle.settingsStore.currentSettings;
			return { events: filterImportedEvents(parsedEvents, filterExpression, settings, timezone), error: null };
		} catch (error) {
			return { events: [], error: describeError(error) };
		}
	}, [parsedEvents, selectedBundle, filterExpression, timezone]);
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
			if (!selectedBundle || filtered.events.length === 0) {
				new Notice("Please select a file and calendar");
				return;
			}
			onSubmit({ bundle: selectedBundle, events: filtered.events, timezone: values.timezone });
		})();
	}, [form, selectedBundle, filtered.events, onSubmit]);

	const canSubmit = filtered.events.length > 0 && !parseError && !filtered.error;

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
						filterPreset: filterPresetFieldOverride(filterPresets, tid("ics-import-control-filterPreset")),
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
				{filtered.error && (
					<div className={cls("ics-import-preview")}>
						<p className={cls("ics-import-error")} data-testid={tid("ics-import-filter-error")}>
							{filtered.error}
						</p>
					</div>
				)}
				{parsedEvents.length > 0 && !filtered.error && (
					<EventPreviewList events={filtered.events} totalCount={parsedEvents.length} />
				)}
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
