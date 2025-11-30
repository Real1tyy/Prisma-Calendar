import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { Modal, Notice } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { COMMON_TIMEZONES } from "../../utils/ics-export";
import { type ICSImportResult, type ImportedEvent, parseICSContent } from "../../utils/ics-import";

export class ICSImportModal extends Modal {
	private calendars: CalendarBundle[];
	private onImport: (bundle: CalendarBundle, events: ImportedEvent[], timezone: string) => Promise<void>;
	private selectedBundle: CalendarBundle | null = null;
	private selectedTimezone: string = "UTC";
	private parsedEvents: ImportedEvent[] = [];
	private fileInput: HTMLInputElement | null = null;
	private calendarSelectEl: HTMLSelectElement | null = null;
	private timezoneSelectEl: HTMLSelectElement | null = null;
	private previewEl: HTMLElement | null = null;
	private importButton: HTMLButtonElement | null = null;

	constructor(
		app: App,
		calendars: CalendarBundle[],
		onImport: (bundle: CalendarBundle, events: ImportedEvent[], timezone: string) => Promise<void>
	) {
		super(app);
		this.calendars = calendars;
		this.onImport = onImport;
		this.selectedBundle = calendars[0] || null;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("ics-import-modal"));

		contentEl.createEl("h2", { text: "Import .ics file" });

		const formEl = contentEl.createDiv({ cls: cls("ics-import-form") });

		const fileSection = formEl.createDiv({ cls: cls("ics-import-section") });
		fileSection.createEl("label", { text: "Select .ics file" });
		this.fileInput = fileSection.createEl("input", {
			type: "file",
			attr: { accept: ".ics,.ical" },
		});
		this.fileInput.addEventListener("change", () => {
			void this.handleFileSelect();
		});

		const calendarSection = formEl.createDiv({ cls: cls("ics-import-section") });
		calendarSection.createEl("label", { text: "Import to calendar" });
		this.calendarSelectEl = calendarSection.createEl("select", {
			cls: cls("ics-import-calendar-select"),
		});

		for (const bundle of this.calendars) {
			const option = this.calendarSelectEl.createEl("option", {
				value: bundle.calendarId,
				text: bundle.settingsStore.currentSettings.name,
			});
			if (bundle === this.selectedBundle) {
				option.selected = true;
			}
		}

		this.calendarSelectEl.addEventListener("change", () => {
			const selectedId = this.calendarSelectEl?.value;
			this.selectedBundle = this.calendars.find((b) => b.calendarId === selectedId) || null;
		});

		const timezoneSection = formEl.createDiv({ cls: cls("ics-import-section") });
		timezoneSection.createEl("label", { text: "Timezone" });
		this.timezoneSelectEl = timezoneSection.createEl("select", {
			cls: cls("ics-import-timezone-select"),
		});

		for (const tz of COMMON_TIMEZONES) {
			const option = this.timezoneSelectEl.createEl("option", {
				value: tz.id,
				text: tz.label,
			});
			if (tz.id === "UTC") {
				option.selected = true;
			}
		}

		this.timezoneSelectEl.addEventListener("change", () => {
			this.selectedTimezone = this.timezoneSelectEl?.value || "UTC";
			this.showPreview();
		});

		this.previewEl = formEl.createDiv({ cls: cls("ics-import-preview") });
		this.previewEl.createEl("p", {
			text: "Select an .ics file to preview events",
			cls: cls("ics-import-preview-placeholder"),
		});

		const buttonRow = formEl.createDiv({ cls: cls("ics-import-buttons") });

		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		this.importButton = buttonRow.createEl("button", {
			text: "Import",
			cls: "mod-cta",
		});
		this.importButton.disabled = true;
		this.importButton.addEventListener("click", () => {
			void this.handleImport();
		});
	}

	private async handleFileSelect(): Promise<void> {
		const file = this.fileInput?.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const result: ICSImportResult = parseICSContent(content);

			if (!result.success) {
				this.showPreviewError(result.error?.message || "Failed to parse ICS file");
				return;
			}

			this.parsedEvents = result.events;
			this.showPreview();
		} catch (error) {
			this.showPreviewError(error instanceof Error ? error.message : "Failed to read file");
		}
	}

	private showPreview(): void {
		if (!this.previewEl) return;
		this.previewEl.empty();

		if (this.parsedEvents.length === 0) {
			this.previewEl.createEl("p", { text: "No events found in file" });
			if (this.importButton) this.importButton.disabled = true;
			return;
		}

		this.previewEl.createEl("h4", { text: `Found ${this.parsedEvents.length} events:` });

		const listEl = this.previewEl.createEl("ul", { cls: cls("ics-import-event-list") });

		const maxPreview = Math.min(this.parsedEvents.length, 10);
		for (let i = 0; i < maxPreview; i++) {
			const event = this.parsedEvents[i];
			const itemEl = listEl.createEl("li");

			const titleEl = itemEl.createEl("strong");
			titleEl.setText(event.title);

			const dateStr = event.allDay ? event.start.toLocaleDateString() : event.start.toLocaleString();
			itemEl.createEl("span", { text: ` - ${dateStr}` });
		}

		if (this.parsedEvents.length > maxPreview) {
			listEl.createEl("li", {
				text: `... and ${this.parsedEvents.length - maxPreview} more`,
				cls: cls("ics-import-more"),
			});
		}

		if (this.importButton) this.importButton.disabled = false;
	}

	private showPreviewError(message: string): void {
		if (!this.previewEl) return;
		this.previewEl.empty();
		this.previewEl.createEl("p", {
			text: `Error: ${message}`,
			cls: cls("ics-import-error"),
		});
		this.parsedEvents = [];
		if (this.importButton) this.importButton.disabled = true;
	}

	private async handleImport(): Promise<void> {
		if (!this.selectedBundle || this.parsedEvents.length === 0) {
			new Notice("Please select a file and calendar");
			return;
		}

		try {
			await this.onImport(this.selectedBundle, this.parsedEvents, this.selectedTimezone);
			this.close();
		} catch (error) {
			console.error("Import failed:", error);
			new Notice("Failed to import events. See console for details.");
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
