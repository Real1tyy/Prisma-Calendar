import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { COMMON_TIMEZONES } from "../../utils/ics-export";

export interface ExportOptions {
	bundle: CalendarBundle;
	timezone: string;
	excludeSkipped: boolean;
}

export class CalendarSelectModal extends Modal {
	private onSelect: (options: ExportOptions) => void;
	private calendars: CalendarBundle[];
	private selectedBundle: CalendarBundle | null = null;
	private selectedTimezone: string = "UTC";
	private excludeSkipped: boolean = true;

	constructor(app: App, calendars: CalendarBundle[], onSelect: (options: ExportOptions) => void) {
		super(app);
		this.calendars = calendars;
		this.onSelect = onSelect;
		this.selectedBundle = calendars[0] || null;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("calendar-export-modal"));

		contentEl.createEl("h2", { text: "Export calendar" });

		const formEl = contentEl.createDiv({ cls: cls("export-form") });

		const calendarSection = formEl.createDiv({ cls: cls("export-section") });
		calendarSection.createEl("label", { text: "Calendar" });
		const calendarSelect = calendarSection.createEl("select", { cls: cls("export-select") });

		for (const bundle of this.calendars) {
			const calendarName = bundle.settingsStore.currentSettings.name;
			const eventCount = bundle.eventStore.getAllEvents().length;
			const option = calendarSelect.createEl("option", {
				value: bundle.calendarId,
				text: `${calendarName} (${eventCount} events)`,
			});
			if (bundle === this.selectedBundle) {
				option.selected = true;
			}
		}

		calendarSelect.addEventListener("change", () => {
			this.selectedBundle = this.calendars.find((b) => b.calendarId === calendarSelect.value) || null;
		});

		const timezoneSection = formEl.createDiv({ cls: cls("export-section") });
		timezoneSection.createEl("label", { text: "Timezone" });
		const timezoneSelect = timezoneSection.createEl("select", { cls: cls("export-select") });

		for (const tz of COMMON_TIMEZONES) {
			const option = timezoneSelect.createEl("option", {
				value: tz.id,
				text: tz.label,
			});
			if (tz.id === "UTC") {
				option.selected = true;
			}
		}

		timezoneSelect.addEventListener("change", () => {
			this.selectedTimezone = timezoneSelect.value;
		});

		const checkboxSection = formEl.createDiv({ cls: cls("export-checkbox-section") });
		const checkboxLabel = checkboxSection.createEl("label", { cls: cls("export-checkbox-label") });
		const checkbox = checkboxLabel.createEl("input", { type: "checkbox" });
		checkbox.checked = this.excludeSkipped;
		checkboxLabel.createSpan({ text: "Exclude skipped events" });

		checkbox.addEventListener("change", () => {
			this.excludeSkipped = checkbox.checked;
		});

		const infoEl = formEl.createDiv({ cls: cls("export-info") });
		infoEl.createEl("p", {
			text: "Events will be exported with the selected timezone. Skipped events are marked as hidden in your calendar.",
		});

		const buttonRow = formEl.createDiv({ cls: cls("export-buttons") });

		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		const exportButton = buttonRow.createEl("button", {
			text: "Export",
			cls: "mod-cta",
		});
		exportButton.addEventListener("click", () => this.handleExport());
	}

	private handleExport(): void {
		if (!this.selectedBundle) return;

		this.onSelect({
			bundle: this.selectedBundle,
			timezone: this.selectedTimezone,
			excludeSkipped: this.excludeSkipped,
		});
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
