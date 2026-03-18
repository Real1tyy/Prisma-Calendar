import { addCls, cls, generateColors, hexToRgb } from "@real1ty-obsidian-plugins";

import { type ChartDataItem, createChartCanvas, PieChartBuilder } from "../../utils/chart-utils";

type SortDirection = "asc" | "desc";

const MAX_CHART_LABELS = 25;
const ENTRIES_PER_PAGE = 20;

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

export interface DashboardSectionConfig {
	title: string;
	items: DashboardItem[];
	columns: ColumnDef[];
	chartData: ChartDataItem[];
	chartTooltipFormatter?: (label: string, value: number, percentage: string) => string;
	onItemClick?: (item: DashboardItem) => void;
	emptyMessage: string;
}

export interface DashboardSectionHandle {
	destroy: () => void;
}

export function renderDashboardSection(container: HTMLElement, config: DashboardSectionConfig): DashboardSectionHandle {
	let chartBuilder: PieChartBuilder | null = null;
	let collapsed = false;
	let searchQuery = "";
	let sortKey = "";
	let sortDirection: SortDirection = "desc";
	let currentPage = 0;

	const section = container.createDiv(cls("dashboard-section"));

	const header = section.createDiv(cls("dashboard-section-header"));
	const chevron = header.createEl("span", { text: "\u25BC", cls: cls("dashboard-section-chevron") });
	header.createEl("span", { text: `${config.title} (${config.items.length})` });

	const contentEl = section.createDiv(cls("dashboard-section-content"));

	header.addEventListener("click", () => {
		collapsed = !collapsed;
		chevron.textContent = collapsed ? "\u25B6" : "\u25BC";
		if (collapsed) {
			addCls(contentEl, "hidden");
		} else {
			contentEl.classList.remove("prisma-hidden");
		}
	});

	if (config.items.length === 0) {
		contentEl.createDiv({ text: config.emptyMessage, cls: cls("dashboard-section-empty") });
		return { destroy: () => {} };
	}

	const controlsRow = contentEl.createDiv(cls("dashboard-controls"));
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

	const layout = contentEl.createDiv(cls("dashboard-section-layout"));

	const chartPanel = layout.createDiv(cls("dashboard-chart-panel"));
	if (config.chartData.length > 0) {
		const canvas = createChartCanvas(chartPanel, `dashboard-chart-${config.title.replace(/\s+/g, "-").toLowerCase()}`);
		const limitedData = config.chartData.slice(0, MAX_CHART_LABELS);

		chartBuilder = new PieChartBuilder(canvas, limitedData, {
			...(config.chartTooltipFormatter ? { tooltipFormatter: config.chartTooltipFormatter } : {}),
		});
		chartBuilder.render();
	}

	const tablePanel = layout.createDiv(cls("dashboard-table-panel"));
	const tableEl = tablePanel.createEl("table", { cls: cls("dashboard-table") });
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
	const paginationEl = tablePanel.createDiv(cls("dashboard-pagination"));

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

	sortKey = "count";
	sortDirection = "desc";
	renderTable();
	updateSortIndicators();

	return {
		destroy: () => {
			chartBuilder?.destroy();
			chartBuilder = null;
		},
	};
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
