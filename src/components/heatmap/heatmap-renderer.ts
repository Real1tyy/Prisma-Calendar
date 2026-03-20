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
const CELL_RADIUS_YEARLY = 2;
const CELL_RADIUS_MONTHLY = 3;

const DEFAULT_GRADIENT = ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getColorBucket(count: number, thresholds: [number, number, number]): number {
	if (count === 0) return 0;
	if (count <= thresholds[0]) return 1;
	if (count <= thresholds[1]) return 2;
	if (count <= thresholds[2]) return 3;
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

function getYearlyColumn(day: DateTime, startDate: DateTime, firstDayOfWeek: number): number {
	const startOffset = normalizedDayOfWeek(startDate, firstDayOfWeek);
	const dayIndex = Math.floor(day.diff(startDate, "days").days);
	return Math.floor((dayIndex + startOffset) / 7);
}

function formatDateLabel(dt: DateTime): string {
	return dt.toFormat("LLL d, yyyy");
}

interface HeatmapCellParams {
	x: number;
	y: number;
	size: number;
	radius: number;
	dateKey: string;
	day: DateTime;
	count: number;
	categoryColor: string | undefined;
	thresholds: [number, number, number];
	events: CalendarEvent[];
	onDayClick: ((date: string, events: CalendarEvent[]) => void) | undefined;
}

function createHeatmapCell(params: HeatmapCellParams): SVGRectElement {
	const { x, y, size, radius, dateKey, day, count, categoryColor, thresholds, events, onDayClick } = params;

	const bucket = getColorBucket(count, thresholds);
	const rect = createSVGElement("rect", {
		x: String(x),
		y: String(y),
		width: String(size),
		height: String(size),
		rx: String(radius),
		ry: String(radius),
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
		rect.setAttribute("tabindex", "0");
		rect.setAttribute("role", "button");

		const handleClick = () => onDayClick(dateKey, events);
		rect.addEventListener("click", handleClick);
		rect.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" || evt.key === " ") {
				evt.preventDefault();
				handleClick();
			}
		});
	}

	return rect;
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

	const dayLabelIndices = [0, 2, 4];
	for (const i of dayLabelIndices) {
		const adjustedIndex = (i + firstDayOfWeek) % 7;
		const text = createSVGElement("text", {
			x: String(labelWidth - 5),
			y: String(headerHeight + i * step + cellSize),
			class: cls("heatmap-day-label"),
		});
		text.textContent = DAY_LABELS[adjustedIndex]!;
		svg.appendChild(text);
	}

	for (let m = 1; m <= 12; m++) {
		const firstOfMonth = DateTime.local(year, m, 1);
		const col = getYearlyColumn(firstOfMonth, startDate, firstDayOfWeek);
		const text = createSVGElement("text", {
			x: String(labelWidth + col * step),
			y: "12",
			class: cls("heatmap-month-label"),
		});
		text.textContent = firstOfMonth.toFormat("LLL");
		svg.appendChild(text);
	}

	let day = startDate;
	while (day <= endDate) {
		const row = normalizedDayOfWeek(day, firstDayOfWeek);
		const col = getYearlyColumn(day, startDate, firstDayOfWeek);
		const dateKey = day.toFormat("yyyy-MM-dd");
		const dayData = dataset.days.get(dateKey);

		svg.appendChild(
			createHeatmapCell({
				x: labelWidth + col * step,
				y: headerHeight + row * step,
				size: cellSize,
				radius: CELL_RADIUS_YEARLY,
				dateKey,
				day,
				count: dayData?.count ?? 0,
				categoryColor,
				thresholds: dataset.thresholds,
				events: dayData?.events ?? [],
				onDayClick,
			})
		);

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

	for (let d = 1; d <= daysInMonth; d++) {
		const day = DateTime.local(year, month, d);
		const offset = normalizedDayOfWeek(day, firstDayOfWeek);
		const weekRow = Math.floor((d - 1 + startOffset) / 7);
		const dateKey = day.toFormat("yyyy-MM-dd");
		const dayData = dataset.days.get(dateKey);

		const x = offset * step;
		const y = headerHeight + weekRow * step;

		svg.appendChild(
			createHeatmapCell({
				x,
				y,
				size: cellSize,
				radius: CELL_RADIUS_MONTHLY,
				dateKey,
				day,
				count: dayData?.count ?? 0,
				categoryColor,
				thresholds: dataset.thresholds,
				events: dayData?.events ?? [],
				onDayClick,
			})
		);

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

function createSVGElement<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs?: Record<string, string>
): SVGElementTagNameMap[K] {
	const el = document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElementTagNameMap[K];
	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			el.setAttribute(key, value);
		}
	}
	return el;
}

export function renderHeatmapLegend(
	container: HTMLElement,
	thresholds: [number, number, number],
	categoryColor?: string
): void {
	const legend = container.createDiv(cls("heatmap-legend"));
	legend.createSpan({ text: "Less", cls: cls("heatmap-legend-label") });

	const bucketLabels: [string, string, string, string, string] = [
		"0 events",
		`1–${thresholds[0]}`,
		`${thresholds[0] + 1}–${thresholds[1]}`,
		`${thresholds[1] + 1}–${thresholds[2]}`,
		`${thresholds[2] + 1}+`,
	];

	for (let bucket = 0; bucket <= 4; bucket++) {
		const swatch = legend.createDiv(cls("heatmap-legend-swatch"));
		swatch.style.backgroundColor = getCellColor(bucket, categoryColor);
		swatch.title = bucketLabels[bucket]!;
		swatch.setAttribute("aria-label", bucketLabels[bucket]!);
	}

	legend.createSpan({ text: "More", cls: cls("heatmap-legend-label") });
}
