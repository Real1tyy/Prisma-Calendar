import { cls, renderSchemaForm, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { z } from "zod";

import { CSS_PREFIX } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";
import { type ICSImportResult, type ImportedEvent, parseICSContent } from "../../../core/integrations/ics-import";
import { createModalButtons } from "../../../utils/dom-utils";

const ImportOptionsShape = {
	calendar: z.string().min(1),
	timezone: z.string().min(1),
};

function renderICSImportForm(
	el: HTMLElement,
	calendars: CalendarBundle[],
	onImport: (bundle: CalendarBundle, events: ImportedEvent[], timezone: string) => Promise<void>,
	close: () => void
): void {
	let parsedEvents: ImportedEvent[] = [];

	el.createEl("h2", { text: "Import .ics file" });

	const formEl = el.createDiv({ cls: cls("ics-import-form") });

	const fileSection = formEl.createDiv({ cls: cls("ics-import-section") });
	fileSection.createEl("label", { text: "Select .ics file" });
	const fileInput = fileSection.createEl("input", {
		type: "file",
		attr: { accept: ".ics,.ical" },
	});

	const optionsContainer = formEl.createDiv();
	const handle = renderSchemaForm(optionsContainer, {
		shape: ImportOptionsShape,
		prefix: CSS_PREFIX,
		existing: { calendar: calendars[0]?.calendarId ?? "", timezone: "UTC" },
		fieldOverrides: {
			calendar: {
				label: "Import to calendar",
				options: calendars.map((b) => ({
					value: b.calendarId,
					label: b.settingsStore.currentSettings.name,
				})),
			},
			timezone: {
				label: "Timezone",
				options: COMMON_TIMEZONES.map((tz) => ({ value: tz.id, label: tz.label })),
			},
		},
	});

	const previewEl = formEl.createDiv({ cls: cls("ics-import-preview") });
	previewEl.createEl("p", {
		text: "Select an .ics file to preview events",
		cls: cls("ics-import-preview-placeholder"),
	});

	const { submitButton: importButton } = createModalButtons(formEl, {
		submitText: "Import",
		onSubmit: () => {
			const values = handle.getValues();
			const selectedBundle = calendars.find((b) => b.calendarId === values["calendar"]);
			if (!selectedBundle || parsedEvents.length === 0) {
				new Notice("Please select a file and calendar");
				return;
			}

			void onImport(selectedBundle, parsedEvents, String(values["timezone"]))
				.then(() => close())
				.catch((error) => {
					console.error("[ICSImport] Import failed:", error);
					new Notice("Failed to import events. See console for details.");
				});
		},
		onCancel: close,
	});
	importButton.disabled = true;

	function showPreview(): void {
		previewEl.empty();

		if (parsedEvents.length === 0) {
			previewEl.createEl("p", { text: "No events found in file" });
			importButton.disabled = true;
			return;
		}

		previewEl.createEl("h4", { text: `Found ${parsedEvents.length} events:` });
		const listEl = previewEl.createEl("ul", { cls: cls("ics-import-event-list") });

		const maxPreview = Math.min(parsedEvents.length, 10);
		for (let i = 0; i < maxPreview; i++) {
			const event = parsedEvents[i];
			const itemEl = listEl.createEl("li");
			itemEl.createEl("strong").setText(event.title);
			const dateStr = event.allDay ? event.start.toLocaleDateString() : event.start.toLocaleString();
			itemEl.createEl("span", { text: ` - ${dateStr}` });
		}

		if (parsedEvents.length > maxPreview) {
			listEl.createEl("li", {
				text: `... and ${parsedEvents.length - maxPreview} more`,
				cls: cls("ics-import-more"),
			});
		}

		importButton.disabled = false;
	}

	function showPreviewError(message: string): void {
		previewEl.empty();
		previewEl.createEl("p", { text: `Error: ${message}`, cls: cls("ics-import-error") });
		parsedEvents = [];
		importButton.disabled = true;
	}

	fileInput.addEventListener("change", () => {
		const file = fileInput.files?.[0];
		if (!file) return;

		void file
			.text()
			.then((content) => {
				const result: ICSImportResult = parseICSContent(content);
				if (!result.success) {
					showPreviewError(result.error?.message || "Failed to parse ICS file");
					return;
				}
				parsedEvents = result.events;
				showPreview();
			})
			.catch((error) => {
				showPreviewError(error instanceof Error ? error.message : "Failed to read file");
			});
	});
}

export function showICSImportModal(
	app: App,
	calendars: CalendarBundle[],
	onImport: (bundle: CalendarBundle, events: ImportedEvent[], timezone: string) => Promise<void>
): void {
	showModal({
		app,
		cls: cls("ics-import-modal"),
		render: (el, ctx) => renderICSImportForm(el, calendars, onImport, ctx.close),
	});
}
