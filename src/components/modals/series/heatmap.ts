import { addCls, buildColorGradient, cls, ColorEvaluator, hexToRgb, showModal } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { resolveAllEventColors } from "../../../utils/event-color";
import { cleanupTitle } from "../../../utils/events/naming";
import { emitHover } from "../../../utils/obsidian";
import { getDisplayProperties, renderPropertyValue } from "../../../utils/property-display";
import { injectOverflowDots } from "../../calendar-event-renderer";
import { buildHeatmapDataset, type HeatmapDataset } from "../../heatmap/heatmap-data";
import {
	findAdjacentCell,
	type HeatmapGrid,
	type HeatmapGridCell,
	renderHeatmapLegend,
	renderHeatmapSVG,
} from "../../heatmap/heatmap-renderer";

export type HeatmapMode = "yearly" | "monthly";

export interface HeatmapNavigationState {
	mode: HeatmapMode;
	year: number;
	month: number;
}

export interface EventSeriesHeatmapConfig {
	events: CalendarEvent[];
	/** Optional title shown above the heatmap (used in modal context). */
	title?: string;
	categoryColor?: string;
	/** Element to place in the left side of the toolbar (e.g., filter bar). */
	toolbarLeft?: HTMLElement;
	/** Initial view mode (defaults to "yearly"). */
	initialMode?: HeatmapMode;
	/** Hides the yearly/monthly toggle so the mode stays fixed. */
	lockMode?: boolean;
	/** Called whenever the viewed period changes (navigate, mode switch, now). */
	onNavigate?: (state: HeatmapNavigationState) => void;
}

export interface HeatmapHandle {
	destroy: () => void;
	refresh: (events: CalendarEvent[]) => void;
	navigate: (direction: number) => void;
	handleArrow: (direction: "up" | "down" | "left" | "right") => void;
}

/**
 * Renders a heatmap visualization into any container element.
 * Returns a handle for cleanup and refreshing with new events.
 */
export function renderHeatmapInto(
	container: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	config: EventSeriesHeatmapConfig
): HeatmapHandle {
	const colorEvaluator = new ColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);
	let mode: HeatmapMode = config.initialMode ?? "yearly";
	const now = DateTime.now();
	let year = now.year;
	let month = now.month;
	let dataset: HeatmapDataset;
	let grid: HeatmapGrid | null = null;
	let selectedCell: HeatmapGridCell | null = null;

	const SELECTED_CLS = cls("heatmap-cell-selected");

	function deselectCell(): void {
		if (selectedCell) {
			selectedCell.element.classList.remove(SELECTED_CLS);
			selectedCell = null;
			dayDetailPanel.empty();
		}
	}

	function selectCell(cell: HeatmapGridCell): void {
		if (selectedCell === cell) {
			deselectCell();
			return;
		}
		deselectCell();
		selectedCell = cell;
		cell.element.classList.add(SELECTED_CLS);
		showDayDetail(cell.dateKey, cell.events);
	}

	if (config.title) {
		const titleHeader = container.createDiv(cls("heatmap-header"));
		titleHeader.createEl("h2", { text: config.title });
	}

	const toolbar = container.createDiv(cls("view-header-row"));
	const toolbarLeft = toolbar.createDiv(cls("view-header-left"));
	const toolbarRight = toolbar.createDiv(cls("view-header-right"));

	if (config.toolbarLeft) toolbarLeft.appendChild(config.toolbarLeft);

	if (!config.lockMode) {
		const modeGroup = toolbarRight.createDiv(cls("heatmap-mode-group"));
		const yearlyBtn = modeGroup.createEl("button", { text: "Yearly", cls: cls("heatmap-mode-btn") });
		const monthlyBtn = modeGroup.createEl("button", { text: "Monthly", cls: cls("heatmap-mode-btn") });
		addCls(mode === "yearly" ? yearlyBtn : monthlyBtn, "is-active");

		yearlyBtn.addEventListener("click", () => {
			mode = "yearly";
			yearlyBtn.className = cls("heatmap-mode-btn");
			addCls(yearlyBtn, "is-active");
			monthlyBtn.className = cls("heatmap-mode-btn");
			renderView();
		});

		monthlyBtn.addEventListener("click", () => {
			mode = "monthly";
			yearlyBtn.className = cls("heatmap-mode-btn");
			monthlyBtn.className = cls("heatmap-mode-btn");
			addCls(monthlyBtn, "is-active");
			renderView();
		});
	}

	const controls = container.createDiv(cls("heatmap-controls"));
	const navGroup = controls.createDiv(cls("heatmap-nav-group"));
	const prevBtn = navGroup.createEl("button", { text: "\u2190", cls: cls("heatmap-nav-btn") });
	const controlsLabel = navGroup.createSpan(cls("heatmap-nav-label"));
	const nextBtn = navGroup.createEl("button", { text: "\u2192", cls: cls("heatmap-nav-btn") });
	const nowBtn = controls.createEl("button", { text: "Now", cls: cls("heatmap-nav-btn") });

	function navigate(direction: number): void {
		if (mode === "yearly") {
			year += direction;
		} else {
			month += direction;
			if (month < 1) {
				month = 12;
				year--;
			} else if (month > 12) {
				month = 1;
				year++;
			}
		}
		renderView();
	}

	prevBtn.addEventListener("click", () => navigate(-1));
	nextBtn.addEventListener("click", () => navigate(1));
	nowBtn.addEventListener("click", () => {
		const current = DateTime.now();
		year = current.year;
		month = current.month;
		renderView();
	});

	const legendContainer = container.createDiv(cls("heatmap-legend-container"));
	const svgContainer = container.createDiv({
		cls: cls("heatmap-container"),
		attr: { "data-testid": "prisma-heatmap-container" },
	});
	const dayDetailPanel = container.createDiv(cls("heatmap-day-detail"));

	function updateLabel(): void {
		if (mode === "yearly") {
			controlsLabel.textContent = String(year);
		} else {
			const dt = DateTime.local(year, month, 1);
			controlsLabel.textContent = dt.toFormat("LLLL yyyy");
		}
	}

	function showDayDetail(date: string, events: CalendarEvent[]): void {
		dayDetailPanel.empty();

		const dt = DateTime.fromISO(date);
		const detailHeader = dayDetailPanel.createDiv(cls("heatmap-detail-header"));
		detailHeader.createEl("h3", { text: dt.toFormat("EEEE, LLLL d, yyyy") });
		detailHeader.createSpan({
			text: `${events.length} event${events.length === 1 ? "" : "s"}`,
			cls: cls("heatmap-detail-count"),
		});

		if (events.length === 0) {
			dayDetailPanel.createEl("p", {
				text: "No events on this day",
				cls: cls("heatmap-detail-empty"),
			});
			return;
		}

		const settings = bundle.settingsStore.currentSettings;
		const displayPropertiesList = settings.frontmatterDisplayPropertiesHeatmap;
		const colorModeCount = settings.colorMode === "off" ? 0 : Number(settings.colorMode);

		const list = dayDetailPanel.createDiv(cls("heatmap-detail-list"));
		for (const event of events) {
			const row = list.createDiv(cls("heatmap-detail-row"));
			const allColors = resolveAllEventColors(event.meta ?? {}, bundle, colorEvaluator);
			const eventColor = allColors[0];
			if (eventColor) {
				addCls(row, "heatmap-detail-row-categorized");
				row.style.setProperty("--category-color", eventColor);
			}
			if (colorModeCount >= 2 && allColors.length >= 2) {
				const appliedColors = allColors.slice(0, colorModeCount).map((c) => {
					const rgb = hexToRgb(c);
					return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)` : c;
				});
				row.style.setProperty("background-image", buildColorGradient(appliedColors));
				row.style.setProperty("border-color", allColors[0]);
			}
			const mainRow = row.createDiv(cls("heatmap-detail-row-main"));
			mainRow.createSpan({ text: cleanupTitle(event.title), cls: cls("heatmap-detail-title") });

			const timeGroup = mainRow.createSpan(cls("heatmap-detail-time-group"));
			if (event.type === "timed") {
				const startDt = DateTime.fromISO(event.start);
				timeGroup.createSpan({ text: startDt.toFormat("h:mm a"), cls: cls("heatmap-detail-time") });
			} else {
				timeGroup.createSpan({ text: "All day", cls: cls("heatmap-detail-time") });
			}

			if (settings.showEventColorDots && allColors.length >= 2) {
				const appliedCount = colorModeCount === 0 ? 0 : Math.min(colorModeCount, allColors.length);
				const overflowColors = allColors.slice(appliedCount);
				injectOverflowDots(row, overflowColors, cls("heatmap-detail-color-dots"), cls("heatmap-detail-color-dot"));
			}

			if (displayPropertiesList.length > 0 && event.meta) {
				const displayProps = getDisplayProperties(event.meta, displayPropertiesList);
				if (displayProps.length > 0) {
					const propsEl = row.createDiv(cls("heatmap-detail-props"));
					for (const [key, value] of displayProps) {
						const propEl = propsEl.createSpan(cls("heatmap-detail-prop"));
						propEl.createSpan({ text: `${key}: `, cls: cls("prop-key") });
						const valueSpan = propEl.createSpan({ cls: cls("prop-value") });
						renderPropertyValue(valueSpan, value, {
							app,
							linkClassName: cls("prop-link"),
						});
					}
				}
			}

			row.addEventListener("click", (e) => {
				if (e.ctrlKey || e.metaKey) return;
				void app.workspace.openLinkText(event.ref.filePath, "", false);
			});

			row.addEventListener("mouseover", (e) => {
				if (e.ctrlKey || e.metaKey) {
					emitHover(app, container, row, e, event.ref.filePath, bundle.calendarId);
				}
			});
		}
	}

	function renderView(): void {
		selectedCell = null;
		updateLabel();
		legendContainer.empty();
		dayDetailPanel.empty();
		renderHeatmapLegend(legendContainer, dataset.thresholds, config.categoryColor);
		config.onNavigate?.({ mode, year, month });

		const firstDayOfWeek = bundle.settingsStore.currentSettings.firstDayOfWeek ?? 0;
		grid = renderHeatmapSVG(svgContainer, dataset, {
			mode,
			year,
			month,
			firstDayOfWeek,
			...(config.categoryColor ? { categoryColor: config.categoryColor } : {}),
			onDayClick: (date) => {
				const clicked = grid!.cells.find((c) => c.dateKey === date)!;
				selectCell(clicked);
			},
		});
	}

	function handleArrow(direction: "up" | "down" | "left" | "right"): void {
		if (!selectedCell || !grid) {
			if (direction === "left") navigate(-1);
			else if (direction === "right") navigate(1);
			return;
		}
		const next = findAdjacentCell(grid, selectedCell, direction);
		if (next) selectCell(next);
	}

	dataset = buildHeatmapDataset(config.events);
	renderView();

	return {
		destroy: () => {
			colorEvaluator.destroy();
			container.empty();
		},
		refresh: (events: CalendarEvent[]) => {
			dataset = buildHeatmapDataset(events);
			renderView();
		},
		navigate,
		handleArrow,
	};
}

export function showHeatmapModal(app: App, bundle: CalendarBundle, config: EventSeriesHeatmapConfig): void {
	let handle: HeatmapHandle | null = null;
	showModal({
		app,
		cls: cls("heatmap-modal"),
		render: (el, ctx) => {
			handle = renderHeatmapInto(el, app, bundle, config);

			if (ctx.type === "modal") {
				const arrowDirections = {
					ArrowLeft: "left",
					ArrowRight: "right",
					ArrowUp: "up",
					ArrowDown: "down",
				} as const;

				for (const [key, dir] of Object.entries(arrowDirections)) {
					ctx.scope.register([], key, () => {
						handle?.handleArrow(dir);
						return false;
					});
				}
			}
		},
		cleanup: () => {
			handle?.destroy();
			handle = null;
		},
	});
}
