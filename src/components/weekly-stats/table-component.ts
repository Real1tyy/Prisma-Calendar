import { cls } from "@real1ty-obsidian-plugins";
import type { WeeklyStatEntry } from "../../utils/weekly-stats";
import { formatDuration, formatDurationAsDecimalHours, formatPercentage } from "../../utils/weekly-stats";

const ENTRIES_PER_PAGE = 20;

export class TableComponent {
	private entries: WeeklyStatEntry[];
	private totalDuration: number;
	private showDecimalHours: boolean;
	private currentPage = 0;
	private totalPages: number;
	private tableBody: HTMLElement | null = null;
	private paginationContainer: HTMLElement | null = null;

	constructor(parentEl: HTMLElement, entries: WeeklyStatEntry[], totalDuration: number, showDecimalHours = false) {
		this.entries = entries;
		this.totalDuration = totalDuration;
		this.showDecimalHours = showDecimalHours;
		this.totalPages = Math.ceil(entries.length / ENTRIES_PER_PAGE);
		this.createTableSection(parentEl);
		this.render();
	}

	private createTableSection(parentEl: HTMLElement): void {
		const tableContainer = parentEl.createDiv(cls("stats-table-container"));

		tableContainer.createDiv(cls("stats-table-divider"));

		const table = tableContainer.createEl("table", { cls: cls("stats-table") });

		// Table header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		headerRow.createEl("th", { text: "Event name" });
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
			row.createEl("td", {
				text: this.showDecimalHours ? formatDurationAsDecimalHours(entry.duration) : formatDuration(entry.duration),
			});
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

		// First page button
		const firstButton = this.paginationContainer.createEl("button", {
			text: "First",
			cls: cls("stats-pagination-button"),
		});
		firstButton.disabled = this.currentPage === 0;
		firstButton.addEventListener("click", () => {
			this.currentPage = 0;
			this.render();
		});

		// Previous button
		const prevButton = this.paginationContainer.createEl("button", {
			text: "Previous",
			cls: cls("stats-pagination-button"),
		});
		prevButton.disabled = this.currentPage === 0;
		prevButton.addEventListener("click", () => {
			if (this.currentPage > 0) {
				this.currentPage--;
				this.render();
			}
		});

		// Page input and info
		const pageInputContainer = this.paginationContainer.createDiv(cls("stats-pagination-input-container"));

		pageInputContainer.createEl("span", {
			text: "Page ",
			cls: cls("stats-pagination-label"),
		});

		const pageInput = pageInputContainer.createEl("input", {
			type: "number",
			cls: cls("stats-pagination-input"),
			attr: {
				min: "1",
				max: this.totalPages.toString(),
			},
		});
		pageInput.value = (this.currentPage + 1).toString();

		pageInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.handlePageInput(pageInput);
			}
		});

		pageInput.addEventListener("blur", () => {
			this.handlePageInput(pageInput);
		});

		pageInputContainer.createEl("span", {
			text: ` of ${this.totalPages}`,
			cls: cls("stats-pagination-label"),
		});

		const entriesInfo = this.paginationContainer.createDiv(cls("stats-pagination-info"));
		entriesInfo.setText(`(${this.entries.length} entries)`);

		// Next button
		const nextButton = this.paginationContainer.createEl("button", {
			text: "Next",
			cls: cls("stats-pagination-button"),
		});
		nextButton.disabled = this.currentPage >= this.totalPages - 1;
		nextButton.addEventListener("click", () => {
			if (this.currentPage < this.totalPages - 1) {
				this.currentPage++;
				this.render();
			}
		});

		// Last page button
		const lastButton = this.paginationContainer.createEl("button", {
			text: "Last",
			cls: cls("stats-pagination-button"),
		});
		lastButton.disabled = this.currentPage >= this.totalPages - 1;
		lastButton.addEventListener("click", () => {
			this.currentPage = this.totalPages - 1;
			this.render();
		});
	}

	private handlePageInput(input: HTMLInputElement): void {
		const value = Number.parseInt(input.value, 10);

		if (Number.isNaN(value) || value < 1 || value > this.totalPages) {
			input.value = (this.currentPage + 1).toString();
			return;
		}

		const newPage = value - 1;
		if (newPage !== this.currentPage) {
			this.currentPage = newPage;
			this.render();
		}
	}

	destroy(): void {
		// No cleanup needed for now
	}
}
