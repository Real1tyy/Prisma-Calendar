import { cls } from "@real1ty-obsidian-plugins";
import { MarkdownRenderChild, Notice } from "obsidian";

import type { CalendarBundle } from "../core/calendar-bundle";
import type CustomCalendarPlugin from "../main";
import { type VirtualEventData, VirtualEventsFileSchema } from "../types/virtual-event";

export class VirtualEventsBlockRenderer extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private source: string,
		private plugin: CustomCalendarPlugin
	) {
		super(containerEl);
	}

	override onload(): void {
		this.render();
	}

	private render(): void {
		const container = this.containerEl;
		container.empty();
		container.addClass(cls("virtual-events-block"));

		let events: VirtualEventData[] = [];
		try {
			const data = JSON.parse(this.source);
			const result = VirtualEventsFileSchema.safeParse(data);
			if (result.success) events = result.data;
		} catch {
			// malformed JSON — keep empty
		}

		if (events.length === 0) {
			container.createEl("p", {
				text: "No virtual events",
				cls: cls("virtual-events-empty"),
			});
			return;
		}

		const bundle = this.findBundleForFile();
		const settings = bundle?.settingsStore.currentSettings;

		const table = container.createEl("table", { cls: cls("virtual-events-table") });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const label of ["Title", "Start", "End", "Category", "Location", "Participants", ""]) {
			headerRow.createEl("th", { text: label });
		}

		const tbody = table.createEl("tbody");
		for (const event of events) {
			const row = tbody.createEl("tr");
			row.createEl("td", { text: event.title });
			row.createEl("td", { text: formatStart(event) });
			row.createEl("td", { text: formatEnd(event) });
			row.createEl("td", { text: getProperty(event, settings?.categoryProp) });
			row.createEl("td", { text: getProperty(event, settings?.locationProp) });
			row.createEl("td", { text: getProperty(event, settings?.participantsProp) });

			const actionsCell = row.createEl("td", { cls: cls("virtual-events-actions") });

			const makeRealBtn = actionsCell.createEl("button", {
				text: "Make real",
				cls: cls("virtual-events-action-btn"),
			});
			makeRealBtn.addEventListener("click", () => {
				if (bundle) {
					void bundle.convertToReal(event.id);
				} else {
					new Notice("No calendar found for this file");
				}
			});

			const showBtn = actionsCell.createEl("button", {
				text: "Show",
				cls: cls("virtual-events-action-btn"),
			});
			showBtn.addEventListener("click", () => {
				if (bundle) {
					void bundle.navigateToEvent(event.start, event.id);
				} else {
					new Notice("No calendar found for this file");
				}
			});
		}
	}

	// Finds the CalendarBundle that owns the virtual events file containing this block
	private findBundleForFile(): CalendarBundle | null {
		const filePath = this.containerEl.closest("[data-path]")?.getAttribute("data-path");
		if (!filePath) return this.plugin.calendarBundles[0] ?? null;

		return (
			this.plugin.calendarBundles.find((b) => b.virtualEventStore.getFilePath() === filePath) ??
			this.plugin.calendarBundles[0] ??
			null
		);
	}
}

function formatStart(event: VirtualEventData): string {
	return event.allDay ? formatDateOnly(event.start) : formatDateTime(event.start);
}

function formatEnd(event: VirtualEventData): string {
	if (!event.end) return "—";
	return event.allDay ? formatDateOnly(event.end) : formatDateTime(event.end);
}

function formatDateTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatDateOnly(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function getProperty(event: VirtualEventData, propName: string | undefined): string {
	if (!propName) return "";
	const value = event.properties[propName];
	if (value == null) return "";
	if (Array.isArray(value)) return value.join(", ");
	return String(value);
}
