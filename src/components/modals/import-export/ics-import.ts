import { cls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";
import { type ICSImportResult, type ImportedEvent, parseICSContent } from "../../../core/integrations/ics-import";

function renderICSImportForm(
	el: HTMLElement,
	calendars: CalendarBundle[],
	onImport: (bundle: CalendarBundle, events: ImportedEvent[], timezone: string) => Promise<void>,
	close: () => void
): void {
	let selectedBundle: CalendarBundle | null = calendars[0] || null;
	let selectedTimezone = "UTC";
	let parsedEvents: ImportedEvent[] = [];

	el.createEl("h2", { text: "Import .ics file" });

	const formEl = el.createDiv({ cls: cls("ics-import-form") });

	const fileSection = formEl.createDiv({ cls: cls("ics-import-section") });
	fileSection.createEl("label", { text: "Select .ics file" });
	const fileInput = fileSection.createEl("input", {
		type: "file",
		attr: { accept: ".ics,.ical" },
	});

	const calendarSection = formEl.createDiv({ cls: cls("ics-import-section") });
	calendarSection.createEl("label", { text: "Import to calendar" });
	const calendarSelectEl = calendarSection.createEl("select", { cls: cls("ics-import-calendar-select") });

	for (const bundle of calendars) {
		const option = calendarSelectEl.createEl("option", {
			value: bundle.calendarId,
			text: bundle.settingsStore.currentSettings.name,
		});
		if (bundle === selectedBundle) {
			option.selected = true;
		}
	}

	calendarSelectEl.addEventListener("change", () => {
		selectedBundle = calendars.find((b) => b.calendarId === calendarSelectEl.value) || null;
	});

	const timezoneSection = formEl.createDiv({ cls: cls("ics-import-section") });
	timezoneSection.createEl("label", { text: "Timezone" });
	const timezoneSelectEl = timezoneSection.createEl("select", { cls: cls("ics-import-timezone-select") });

	for (const tz of COMMON_TIMEZONES) {
		const option = timezoneSelectEl.createEl("option", { value: tz.id, text: tz.label });
		if (tz.id === "UTC") {
			option.selected = true;
		}
	}

	timezoneSelectEl.addEventListener("change", () => {
		selectedTimezone = timezoneSelectEl.value;
		showPreview();
	});

	const previewEl = formEl.createDiv({ cls: cls("ics-import-preview") });
	previewEl.createEl("p", {
		text: "Select an .ics file to preview events",
		cls: cls("ics-import-preview-placeholder"),
	});

	const buttonRow = formEl.createDiv({ cls: cls("ics-import-buttons") });
	const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
	cancelButton.addEventListener("click", close);

	const importButton = buttonRow.createEl("button", { text: "Import", cls: "mod-cta" });
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
			const titleEl = itemEl.createEl("strong");
			titleEl.setText(event.title);
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

	async function handleFileSelect(): Promise<void> {
		const file = fileInput.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const result: ICSImportResult = parseICSContent(content);

			if (!result.success) {
				showPreviewError(result.error?.message || "Failed to parse ICS file");
				return;
			}

			parsedEvents = result.events;
			showPreview();
		} catch (error) {
			showPreviewError(error instanceof Error ? error.message : "Failed to read file");
		}
	}

	fileInput.addEventListener("change", () => void handleFileSelect());

	importButton.addEventListener("click", () => {
		if (!selectedBundle || parsedEvents.length === 0) {
			new Notice("Please select a file and calendar");
			return;
		}

		void onImport(selectedBundle, parsedEvents, selectedTimezone)
			.then(() => close())
			.catch((error) => {
				console.error("[ICSImport] Import failed:", error);
				new Notice("Failed to import events. See console for details.");
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
