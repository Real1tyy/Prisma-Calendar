import { cls } from "../../utils/css-utils";
import type { WeeklyStatEntry } from "../../utils/weekly-stats";
import { formatDuration, formatPercentage } from "../../utils/weekly-stats";

const ENTRIES_PER_PAGE = 20;

export class TableComponent {
	private entries: WeeklyStatEntry[];
	private totalDuration: number;
	private currentPage = 0;
	private totalPages: number;
	private tableBody: HTMLElement | null = null;
	private paginationContainer: HTMLElement | null = null;

	constructor(parentEl: HTMLElement, entries: WeeklyStatEntry[], totalDuration: number) {
		this.entries = entries;
		this.totalDuration = totalDuration;
		this.totalPages = Math.ceil(entries.length / ENTRIES_PER_PAGE);
		this.createTableSection(parentEl);
		this.render();
	}

	private createTableSection(parentEl: HTMLElement): void {
		const tableContainer = parentEl.createDiv(cls("stats-table-container"));
		tableContainer.createEl("h3", { text: "Breakdown" });

		const table = tableContainer.createEl("table", { cls: cls("stats-table") });

		// Table header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		headerRow.createEl("th", { text: "Event Name" });
		headerRow.createEl("th", { text: "Count" });
		headerRow.createEl("th", { text: "Duration" });
		headerRow.createEl("th", { text: "Percentage" });

		// Table body
		this.tableBody = table.createEl("tbody");

		// Pagination controls
		if (this.totalPages > 1) {
			this.paginationContainer = tableContainer.createDiv(cls("stats-pagination"));
		}
	}

	private render(): void {
		if (!this.tableBody) return;

		// Clear existing rows
		this.tableBody.empty();

		// Calculate pagination
		const startIdx = this.currentPage * ENTRIES_PER_PAGE;
		const endIdx = Math.min(startIdx + ENTRIES_PER_PAGE, this.entries.length);
		const pageEntries = this.entries.slice(startIdx, endIdx);

		// Render current page entries
		for (const entry of pageEntries) {
			const row = this.tableBody.createEl("tr");
			row.createEl("td", {
				text: entry.name,
				cls: entry.isRecurring ? cls("stats-recurring") : "",
			});
			row.createEl("td", { text: entry.count.toString() });
			row.createEl("td", { text: formatDuration(entry.duration) });
			row.createEl("td", {
				text: formatPercentage(entry.duration, this.totalDuration),
			});
		}

		// Render pagination controls
		this.renderPagination();
	}

	private renderPagination(): void {
		if (!this.paginationContainer || this.totalPages <= 1) return;

		this.paginationContainer.empty();

		// Previous button
		const prevButton = this.paginationContainer.createEl("button", {
			text: "← Previous",
			cls: cls("stats-pagination-button"),
		});
		prevButton.disabled = this.currentPage === 0;
		prevButton.addEventListener("click", () => {
			if (this.currentPage > 0) {
				this.currentPage--;
				this.render();
			}
		});

		// Page info
		const pageInfo = this.paginationContainer.createDiv(cls("stats-pagination-info"));
		pageInfo.setText(`Page ${this.currentPage + 1} of ${this.totalPages} (${this.entries.length} entries)`);

		// Next button
		const nextButton = this.paginationContainer.createEl("button", {
			text: "Next →",
			cls: cls("stats-pagination-button"),
		});
		nextButton.disabled = this.currentPage >= this.totalPages - 1;
		nextButton.addEventListener("click", () => {
			if (this.currentPage < this.totalPages - 1) {
				this.currentPage++;
				this.render();
			}
		});
	}

	destroy(): void {
		// No cleanup needed for now
	}
}
