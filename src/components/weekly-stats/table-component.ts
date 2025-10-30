import type { WeeklyStatEntry } from "../../utils/weekly-stats";
import { formatDuration, formatPercentage } from "../../utils/weekly-stats";

export class TableComponent {
	constructor(parentEl: HTMLElement, entries: WeeklyStatEntry[], totalDuration: number) {
		this.createTableSection(parentEl, entries, totalDuration);
	}

	private createTableSection(parentEl: HTMLElement, entries: WeeklyStatEntry[], totalDuration: number): HTMLElement {
		const tableContainer = parentEl.createDiv("prisma-stats-table-container");
		tableContainer.createEl("h3", { text: "Breakdown" });

		const table = tableContainer.createEl("table", { cls: "prisma-stats-table" });

		// Table header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		headerRow.createEl("th", { text: "Event Name" });
		headerRow.createEl("th", { text: "Count" });
		headerRow.createEl("th", { text: "Duration" });
		headerRow.createEl("th", { text: "Percentage" });

		// Table body
		const tbody = table.createEl("tbody");
		for (const entry of entries) {
			const row = tbody.createEl("tr");
			row.createEl("td", {
				text: entry.name,
				cls: entry.isRecurring ? "prisma-stats-recurring" : "",
			});
			row.createEl("td", { text: entry.count.toString() });
			row.createEl("td", { text: formatDuration(entry.duration) });
			row.createEl("td", {
				text: formatPercentage(entry.duration, totalDuration),
			});
		}

		return tableContainer;
	}

	destroy(): void {
		// No cleanup needed for now
	}
}
