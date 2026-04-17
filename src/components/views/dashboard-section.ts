import { addCls, cls, generateColors, hexToRgb } from "@real1ty-obsidian-plugins";

import { type ChartDataItem, createChartCanvas, PieChartBuilder } from "../../utils/chart-utils";

type SortDirection = "asc" | "desc";

const MAX_CHART_LABELS = 25;
const ENTRIES_PER_PAGE = 20;
const RANKING_LIMIT = 10;

export interface ColumnDef {
	key: string;
	label: string;
	sortable?: boolean;
	align?: "left" | "center" | "right";
}

export interface DashboardItem {
	key: string;
	title: string;
	count: number;
	color?: string;
	extraProps: Record<string, string | number>;
}

export interface StatEntry {
	label: string;
	value: string | number;
}

export interface DashboardChartHandle {
	destroy: () => void;
}

export interface DashboardTableHandle {
	destroy: () => void;
}

export function renderDashboardChart(
	container: HTMLElement,
	chartData: ChartDataItem[],
	chartId: string,
	tooltipFormatter?: (label: string, value: number, percentage: string) => string
): DashboardChartHandle {
	let chartBuilder: PieChartBuilder | null = null;

	if (chartData.length === 0) {
		container.createDiv({ text: "No data", cls: cls("dashboard-chart-empty") });
		return { destroy: () => {} };
	}

	const canvas = createChartCanvas(container, `dashboard-chart-${chartId}`);
	const limitedData = chartData.slice(0, MAX_CHART_LABELS);

	chartBuilder = new PieChartBuilder(canvas, limitedData, {
		...(tooltipFormatter ? { tooltipFormatter } : {}),
	});
	chartBuilder.render();

	return {
		destroy: () => {
			chartBuilder?.destroy();
			chartBuilder = null;
		},
	};
}

export function renderDashboardRanking(container: HTMLElement, items: DashboardItem[], stats?: StatEntry[]): void {
	if (stats && stats.length > 0) {
		const grid = container.createDiv(cls("dashboard-stats-grid"));
		for (const stat of stats) {
			const card = grid.createDiv(cls("dashboard-stats-card"));
			card.setAttribute("data-testid", `prisma-dashboard-stat-${stat.label}`);
			card.createDiv({
				text: String(stat.value),
				cls: cls("dashboard-stats-value"),
				attr: { "data-testid": `prisma-dashboard-stat-value-${stat.label}` },
			});
			card.createDiv({ text: stat.label, cls: cls("dashboard-stats-label") });
		}
	}

	if (items.length === 0) {
		container.createDiv({ text: "No data", cls: cls("dashboard-chart-empty") });
		return;
	}

	const sorted = [...items].sort((a, b) => b.count - a.count).slice(0, RANKING_LIMIT);
	const maxCount = sorted[0].count;

	const list = container.createDiv(cls("dashboard-ranking"));

	for (const [i, item] of sorted.entries()) {
		const row = list.createDiv(cls("dashboard-ranking-row"));
		row.setAttribute("data-testid", `prisma-dashboard-ranking-row-${item.title}`);
		row.setAttribute("data-item-title", item.title);
		row.createEl("span", { text: `${i + 1}`, cls: cls("dashboard-ranking-pos") });

		const barWrap = row.createDiv(cls("dashboard-ranking-bar-wrap"));
		const bar = barWrap.createDiv(cls("dashboard-ranking-bar"));
		const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
		bar.style.width = `${pct}%`;
		if (item.color) bar.style.backgroundColor = item.color;
		barWrap.createEl("span", { text: item.title, cls: cls("dashboard-ranking-name") });

		row.createEl("span", { text: String(item.count), cls: cls("dashboard-ranking-count") });
	}
}

export function renderDashboardTable(
	container: HTMLElement,
	config: {
		items: DashboardItem[];
		columns: ColumnDef[];
		onItemClick?: (item: DashboardItem) => void;
		emptyMessage: string;
	}
): DashboardTableHandle {
	let searchQuery = "";
	let sortKey = "count";
	let sortDirection: SortDirection = "desc";
	let currentPage = 0;

	if (config.items.length === 0) {
		container.createDiv({ text: config.emptyMessage, cls: cls("dashboard-section-empty") });
		return { destroy: () => {} };
	}

	const controlsRow = container.createDiv(cls("dashboard-controls"));
	const searchInput = controlsRow.createEl("input", {
		type: "text",
		placeholder: "Filter...",
		cls: cls("dashboard-search-input"),
	});
	searchInput.addEventListener("input", () => {
		searchQuery = searchInput.value.toLowerCase().trim();
		currentPage = 0;
		renderTable();
	});

	const tableEl = container.createEl("table", { cls: cls("dashboard-table") });
	const thead = tableEl.createEl("thead");
	const headerRow = thead.createEl("tr");

	for (const col of config.columns) {
		const th = headerRow.createEl("th", { text: col.label });
		if (col.align) th.style.textAlign = col.align;
		if (col.sortable !== false) {
			addCls(th, "dashboard-table-sortable");
			th.addEventListener("click", () => {
				if (sortKey === col.key) {
					sortDirection = sortDirection === "asc" ? "desc" : "asc";
				} else {
					sortKey = col.key;
					sortDirection = "desc";
				}
				currentPage = 0;
				renderTable();
				updateSortIndicators();
			});
		}
	}

	const tbody = tableEl.createEl("tbody");
	const paginationEl = container.createDiv(cls("dashboard-pagination"));

	function updateSortIndicators(): void {
		const ths = headerRow.querySelectorAll("th");
		ths.forEach((th, i) => {
			const col = config.columns[i];
			if (col.key === sortKey) {
				th.textContent = `${col.label} ${sortDirection === "asc" ? "\u2191" : "\u2193"}`;
			} else {
				th.textContent = col.label;
			}
		});
	}

	function getFilteredAndSorted(): DashboardItem[] {
		let items = config.items;

		if (searchQuery) {
			items = items.filter((item) => item.title.toLowerCase().includes(searchQuery));
		}

		if (sortKey) {
			items = [...items].sort((a, b) => {
				let valA: string | number;
				let valB: string | number;

				if (sortKey === "title") {
					valA = a.title;
					valB = b.title;
				} else if (sortKey === "count") {
					valA = a.count;
					valB = b.count;
				} else {
					valA = a.extraProps[sortKey] ?? "";
					valB = b.extraProps[sortKey] ?? "";
				}

				if (typeof valA === "number" && typeof valB === "number") {
					return sortDirection === "asc" ? valA - valB : valB - valA;
				}
				const cmp = String(valA).localeCompare(String(valB));
				return sortDirection === "asc" ? cmp : -cmp;
			});
		}

		return items;
	}

	function renderTable(): void {
		tbody.empty();
		paginationEl.empty();

		const items = getFilteredAndSorted();
		const totalPages = Math.max(1, Math.ceil(items.length / ENTRIES_PER_PAGE));
		if (currentPage >= totalPages) currentPage = totalPages - 1;

		const startIdx = currentPage * ENTRIES_PER_PAGE;
		const pageItems = items.slice(startIdx, startIdx + ENTRIES_PER_PAGE);

		if (pageItems.length === 0) {
			const row = tbody.createEl("tr");
			row.createEl("td", {
				text: "No matching items",
				attr: { colspan: String(config.columns.length) },
			});
			addCls(row, "dashboard-table-empty-row");
			return;
		}

		for (const item of pageItems) {
			const row = tbody.createEl("tr");
			row.setAttribute("data-testid", `prisma-dashboard-table-row-${item.title}`);
			row.setAttribute("data-item-title", item.title);

			if (item.color) {
				const rgb = hexToRgb(item.color);
				if (rgb) {
					row.style.setProperty("--row-color-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
					addCls(row, "dashboard-table-row-colored");
				}
			}

			if (config.onItemClick) {
				addCls(row, "dashboard-table-row-clickable");
				row.addEventListener("click", () => config.onItemClick!(item));
			}

			for (const col of config.columns) {
				let value: string;
				if (col.key === "title") {
					value = item.title;
				} else if (col.key === "count") {
					value = String(item.count);
				} else {
					value = String(item.extraProps[col.key] ?? "");
				}

				const td = row.createEl("td", { text: value });
				if (col.align) td.style.textAlign = col.align;
			}
		}

		if (totalPages > 1) {
			renderPagination(totalPages, items.length);
		}
	}

	function renderPagination(totalPages: number, totalItems: number): void {
		const prevBtn = paginationEl.createEl("button", { text: "\u2190 Prev", cls: cls("dashboard-pagination-btn") });
		prevBtn.disabled = currentPage === 0;
		prevBtn.addEventListener("click", () => {
			if (currentPage > 0) {
				currentPage--;
				renderTable();
			}
		});

		paginationEl.createEl("span", {
			text: `Page ${currentPage + 1} of ${totalPages} (${totalItems} items)`,
			cls: cls("dashboard-pagination-info"),
		});

		const nextBtn = paginationEl.createEl("button", { text: "Next \u2192", cls: cls("dashboard-pagination-btn") });
		nextBtn.disabled = currentPage >= totalPages - 1;
		nextBtn.addEventListener("click", () => {
			if (currentPage < totalPages - 1) {
				currentPage++;
				renderTable();
			}
		});
	}

	renderTable();
	updateSortIndicators();

	return { destroy: () => {} };
}

export function buildChartDataFromItems(items: DashboardItem[]): ChartDataItem[] {
	const sorted = [...items].sort((a, b) => b.count - a.count);

	const allHaveColor = sorted.length > 0 && sorted.every((i) => i.color);
	if (allHaveColor) {
		return sorted.map((item) => ({
			label: item.title,
			value: item.count,
			color: item.color!,
		}));
	}

	const colors = generateColors(sorted.length);
	return sorted.map((item, i) => ({
		label: item.title,
		value: item.count,
		color: item.color ?? colors[i],
	}));
}
