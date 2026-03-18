import { cls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { COMMON_TIMEZONES, type ExportOptions } from "../../../core/integrations/ics-export";

function renderCalendarSelectForm(
	el: HTMLElement,
	calendars: CalendarBundle[],
	onSelect: (options: ExportOptions) => void,
	close: () => void
): void {
	let selectedBundle: CalendarBundle | null = calendars[0] || null;
	let selectedTimezone = "UTC";
	let excludeSkipped = true;

	el.createEl("h2", { text: "Export calendar" });

	const formEl = el.createDiv({ cls: cls("export-form") });

	const calendarSection = formEl.createDiv({ cls: cls("export-section") });
	calendarSection.createEl("label", { text: "Calendar" });
	const calendarSelect = calendarSection.createEl("select", { cls: cls("export-select") });

	for (const bundle of calendars) {
		const calendarName = bundle.settingsStore.currentSettings.name;
		const eventCount = bundle.eventStore.getAllEvents().length;
		const option = calendarSelect.createEl("option", {
			value: bundle.calendarId,
			text: `${calendarName} (${eventCount} events)`,
		});
		if (bundle === selectedBundle) {
			option.selected = true;
		}
	}

	calendarSelect.addEventListener("change", () => {
		selectedBundle = calendars.find((b) => b.calendarId === calendarSelect.value) || null;
	});

	const timezoneSection = formEl.createDiv({ cls: cls("export-section") });
	timezoneSection.createEl("label", { text: "Timezone" });
	const timezoneSelect = timezoneSection.createEl("select", { cls: cls("export-select") });

	for (const tz of COMMON_TIMEZONES) {
		const option = timezoneSelect.createEl("option", { value: tz.id, text: tz.label });
		if (tz.id === "UTC") {
			option.selected = true;
		}
	}

	timezoneSelect.addEventListener("change", () => {
		selectedTimezone = timezoneSelect.value;
	});

	const checkboxSection = formEl.createDiv({ cls: cls("export-checkbox-section") });
	const checkboxLabel = checkboxSection.createEl("label", { cls: cls("export-checkbox-label") });
	const checkbox = checkboxLabel.createEl("input", { type: "checkbox" });
	checkbox.checked = excludeSkipped;
	checkboxLabel.createSpan({ text: "Exclude skipped events" });

	checkbox.addEventListener("change", () => {
		excludeSkipped = checkbox.checked;
	});

	const infoEl = formEl.createDiv({ cls: cls("export-info") });
	infoEl.createEl("p", {
		text: "Events will be exported with the selected timezone. Skipped events are marked as hidden in your calendar.",
	});

	const buttonRow = formEl.createDiv({ cls: cls("export-buttons") });

	const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
	cancelButton.addEventListener("click", close);

	const exportButton = buttonRow.createEl("button", { text: "Export", cls: "mod-cta" });
	exportButton.addEventListener("click", () => {
		if (!selectedBundle) return;
		onSelect({ bundle: selectedBundle, timezone: selectedTimezone, excludeSkipped });
		close();
	});
}

export function showCalendarSelectModal(
	app: App,
	calendars: CalendarBundle[],
	onSelect: (options: ExportOptions) => void
): void {
	showModal({
		app,
		cls: cls("calendar-export-modal"),
		render: (el, ctx) => renderCalendarSelectForm(el, calendars, onSelect, ctx.close),
	});
}
