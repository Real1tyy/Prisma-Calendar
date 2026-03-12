import { cls } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";

import type { CalendarEvent } from "../../types/calendar";
import type { HeatmapDataset } from "./heatmap-data";

export interface HeatmapRenderOptions {
	mode: "yearly" | "monthly";
	year: number;
	month?: number;
	firstDayOfWeek: number;
	categoryColor?: string;
	onDayClick?: (date: string, events: CalendarEvent[]) => void;
}

const CELL_SIZE_YEARLY = 12;
const CELL_GAP_YEARLY = 3;
const CELL_SIZE_MONTHLY = 20;
const CELL_GAP_MONTHLY = 3;

const DEFAULT_GRADIENT = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getColorBucket(count: number, maxCount: number): number {
	if (count === 0 || maxCount === 0) return 0;
	if (maxCount <= 4) return Math.min(count, 4);
	const step = maxCount / 4;
	if (count <= step) return 1;
	if (count <= step * 2) return 2;
	if (count <= step * 3) return 3;
	return 4;
}

function getCellColor(bucket: number, categoryColor?: string): string {
	if (bucket === 0) return "var(--background-modifier-border)";

	if (categoryColor) {
		const opacities = [0, 0.15, 0.35, 0.55, 0.75, 1.0];
		return applyOpacity(categoryColor, opacities[bucket]);
	}

	return DEFAULT_GRADIENT[bucket];
}

function applyOpacity(color: string, opacity: number): string {
	if (color.startsWith("#")) {
		const r = parseInt(color.slice(1, 3), 16);
		const g = parseInt(color.slice(3, 5), 16);
		const b = parseInt(color.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}
	return color;
}

function normalizedDayOfWeek(dt: DateTime, firstDayOfWeek: number): number {
	const isoWeekday = dt.weekday; // 1=Monday, 7=Sunday
	return (isoWeekday - 1 - firstDayOfWeek + 7) % 7;
}

function formatDateLabel(dt: DateTime): string {
	return dt.toFormat("LLL d, yyyy");
}

export function renderHeatmapSVG(container: HTMLElement, dataset: HeatmapDataset, options: HeatmapRenderOptions): void {
	container.empty();

	if (options.mode === "yearly") {
		renderYearly(container, dataset, options);
	} else {
		renderMonthly(container, dataset, options);
	}
}

function renderYearly(container: HTMLElement, dataset: HeatmapDataset, options: HeatmapRenderOptions): void {
	const { year, firstDayOfWeek, categoryColor, onDayClick } = options;
	const cellSize = CELL_SIZE_YEARLY;
	const gap = CELL_GAP_YEARLY;
	const step = cellSize + gap;

	const startDate = DateTime.local(year, 1, 1);
	const endDate = DateTime.local(year, 12, 31);

	// Calculate week columns
	const startOffset = normalizedDayOfWeek(startDate, firstDayOfWeek);
	const totalDays = endDate.diff(startDate, "days").days + 1;
	const totalWeeks = Math.ceil((totalDays + startOffset) / 7);

	const labelWidth = 30;
	const headerHeight = 20;
	const svgWidth = labelWidth + totalWeeks * step;
	const svgHeight = headerHeight + 7 * step;

	const svg = createSVGElement("svg", {
		width: String(svgWidth),
		height: String(svgHeight),
		class: cls("heatmap-svg"),
	});

	// Day-of-week labels
	const dayLabelIndices = [0, 2, 4]; // Mon, Wed, Fri (when firstDayOfWeek=0)
	for (const i of dayLabelIndices) {
		const adjustedIndex = (i + firstDayOfWeek) % 7;
		const text = createSVGElement("text", {
			x: String(labelWidth - 5),
			y: String(headerHeight + i * step + cellSize),
			class: cls("heatmap-day-label"),
		});
		text.textContent = DAY_LABELS[adjustedIndex];
		svg.appendChild(text);
	}

	// Month labels
	let currentMonth = -1;
	let day = startDate;
	let col = 0;

	while (day <= endDate) {
		const month = day.month;
		if (month !== currentMonth) {
			currentMonth = month;
			const colX = labelWidth + col * step;
			const text = createSVGElement("text", {
				x: String(colX),
				y: "12",
				class: cls("heatmap-month-label"),
			});
			text.textContent = day.toFormat("LLL");
			svg.appendChild(text);
		}

		const row = normalizedDayOfWeek(day, firstDayOfWeek);
		if (row === 6) col++;
		day = day.plus({ days: 1 });
	}

	// Render cells
	day = startDate;
	col = 0;
	let lastRow = -1;

	while (day <= endDate) {
		const row = normalizedDayOfWeek(day, firstDayOfWeek);
		if (row <= lastRow) col++;
		lastRow = row;

		const dateKey = day.toFormat("yyyy-MM-dd");
		const dayData = dataset.days.get(dateKey);
		const count = dayData?.count ?? 0;
		const bucket = getColorBucket(count, dataset.maxCount);

		const x = labelWidth + col * step;
		const y = headerHeight + row * step;

		const rect = createSVGElement("rect", {
			x: String(x),
			y: String(y),
			width: String(cellSize),
			height: String(cellSize),
			rx: "2",
			ry: "2",
			fill: getCellColor(bucket, categoryColor),
			class: cls("heatmap-cell"),
			"data-date": dateKey,
			"data-count": String(count),
		});

		const title = createSVGElement("title");
		title.textContent = `${formatDateLabel(day)}: ${count} event${count === 1 ? "" : "s"}`;
		rect.appendChild(title);

		rect.setAttribute("aria-label", title.textContent);

		if (onDayClick) {
			rect.addEventListener("click", () => {
				onDayClick(dateKey, dayData?.events ?? []);
			});
		}

		svg.appendChild(rect);
		day = day.plus({ days: 1 });
	}

	container.appendChild(svg);
}

function renderMonthly(container: HTMLElement, dataset: HeatmapDataset, options: HeatmapRenderOptions): void {
	const { year, month, firstDayOfWeek, categoryColor, onDayClick } = options;
	if (!month) return;

	const cellSize = CELL_SIZE_MONTHLY;
	const gap = CELL_GAP_MONTHLY;
	const step = cellSize + gap;

	const startDate = DateTime.local(year, month, 1);
	const endDate = startDate.endOf("month");
	const daysInMonth = endDate.day;

	const startOffset = normalizedDayOfWeek(startDate, firstDayOfWeek);
	const totalWeeks = Math.ceil((daysInMonth + startOffset) / 7);

	const headerHeight = 25;
	const svgWidth = 7 * step;
	const svgHeight = headerHeight + totalWeeks * step;

	const svg = createSVGElement("svg", {
		width: String(svgWidth),
		height: String(svgHeight),
		class: cls("heatmap-svg"),
	});

	// Day-of-week headers
	for (let i = 0; i < 7; i++) {
		const adjustedIndex = (i + firstDayOfWeek) % 7;
		const text = createSVGElement("text", {
			x: String(i * step + cellSize / 2),
			y: "14",
			class: cls("heatmap-month-day-header"),
		});
		text.textContent = DAY_LABELS[adjustedIndex].charAt(0);
		svg.appendChild(text);
	}

	// Render cells
	for (let d = 1; d <= daysInMonth; d++) {
		const day = DateTime.local(year, month, d);
		const offset = normalizedDayOfWeek(day, firstDayOfWeek);
		const weekRow = Math.floor((d - 1 + startOffset) / 7);

		const dateKey = day.toFormat("yyyy-MM-dd");
		const dayData = dataset.days.get(dateKey);
		const count = dayData?.count ?? 0;
		const bucket = getColorBucket(count, dataset.maxCount);

		const x = offset * step;
		const y = headerHeight + weekRow * step;

		const rect = createSVGElement("rect", {
			x: String(x),
			y: String(y),
			width: String(cellSize),
			height: String(cellSize),
			rx: "3",
			ry: "3",
			fill: getCellColor(bucket, categoryColor),
			class: cls("heatmap-cell"),
			"data-date": dateKey,
			"data-count": String(count),
		});

		const title = createSVGElement("title");
		title.textContent = `${formatDateLabel(day)}: ${count} event${count === 1 ? "" : "s"}`;
		rect.appendChild(title);
		rect.setAttribute("aria-label", title.textContent);

		if (onDayClick) {
			rect.addEventListener("click", () => {
				onDayClick(dateKey, dayData?.events ?? []);
			});
		}

		svg.appendChild(rect);

		// Day number label
		const label = createSVGElement("text", {
			x: String(x + cellSize / 2),
			y: String(y + cellSize / 2 + 4),
			class: cls("heatmap-day-number"),
		});
		label.textContent = String(d);
		svg.appendChild(label);
	}

	container.appendChild(svg);
}

function createSVGElement(tag: string, attrs?: Record<string, string>): SVGElement {
	const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			el.setAttribute(key, value);
		}
	}
	return el;
}

export function renderHeatmapLegend(container: HTMLElement, maxCount: number, categoryColor?: string): void {
	const legend = container.createDiv(cls("heatmap-legend"));
	legend.createSpan({ text: "Less", cls: cls("heatmap-legend-label") });

	for (let bucket = 0; bucket <= 4; bucket++) {
		const swatch = legend.createDiv(cls("heatmap-legend-swatch"));
		swatch.style.backgroundColor = getCellColor(bucket, categoryColor);

		if (bucket > 0 && maxCount > 0) {
			const threshold = Math.ceil((maxCount * bucket) / 4);
			swatch.setAttribute("aria-label", `${threshold}+ events`);
			swatch.title = `${threshold}+ events`;
		} else if (bucket === 0) {
			swatch.title = "0 events";
		}
	}

	legend.createSpan({ text: "More", cls: cls("heatmap-legend-label") });
}
