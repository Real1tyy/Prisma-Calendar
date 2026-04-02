import { cls } from "@real1ty-obsidian-plugins";
import { MarkdownRenderChild } from "obsidian";

import { type VirtualEventData, VirtualEventsFileSchema } from "../types/virtual-event";

export class VirtualEventsBlockRenderer extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private source: string
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

		const table = container.createEl("table", { cls: cls("virtual-events-table") });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		for (const label of ["Title", "Start", "End", "All Day"]) {
			headerRow.createEl("th", { text: label });
		}

		const tbody = table.createEl("tbody");
		for (const event of events) {
			const row = tbody.createEl("tr");
			row.createEl("td", { text: event.title });
			row.createEl("td", { text: formatDateTime(event.start) });
			row.createEl("td", { text: event.end ? formatDateTime(event.end) : "—" });
			row.createEl("td", { text: event.allDay ? "Yes" : "No" });
		}
	}
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
