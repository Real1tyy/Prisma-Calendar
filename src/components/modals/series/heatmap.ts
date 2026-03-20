import { addCls, cls, ColorEvaluator, showModal } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { resolveEventColor } from "../../../utils/event-color";
import { cleanupTitle } from "../../../utils/event-naming";
import { emitHover } from "../../../utils/obsidian";
import { getDisplayProperties, renderPropertyValue } from "../../../utils/property-display";
import { buildHeatmapDataset, type HeatmapDataset } from "../../heatmap/heatmap-data";
import { renderHeatmapLegend, renderHeatmapSVG } from "../../heatmap/heatmap-renderer";

export interface EventSeriesHeatmapConfig {
	events: CalendarEvent[];
	title: string;
	categoryColor?: string;
}

type HeatmapMode = "yearly" | "monthly";

export interface HeatmapHandle {
	destroy: () => void;
	refresh: (events: CalendarEvent[]) => void;
	navigate: (direction: number) => void;
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
	let mode: HeatmapMode = "yearly";
	const now = DateTime.now();
	let year = now.year;
	let month = now.month;
	let dataset: HeatmapDataset;

	const header = container.createDiv(cls("heatmap-header"));
	header.createEl("h2", { text: config.title });

	const modeGroup = header.createDiv(cls("heatmap-mode-group"));
	const yearlyBtn = modeGroup.createEl("button", { text: "Yearly", cls: cls("heatmap-mode-btn") });
	const monthlyBtn = modeGroup.createEl("button", { text: "Monthly", cls: cls("heatmap-mode-btn") });
	addCls(yearlyBtn, "is-active");

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
	const svgContainer = container.createDiv(cls("heatmap-container"));
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

		const list = dayDetailPanel.createDiv(cls("heatmap-detail-list"));
		for (const event of events) {
			const row = list.createDiv(cls("heatmap-detail-row"));
			const eventColor = resolveEventColor(event.meta ?? {}, bundle, colorEvaluator);
			if (eventColor) {
				addCls(row, "heatmap-detail-row-categorized");
				row.style.setProperty("--category-color", eventColor);
			}
			const mainRow = row.createDiv(cls("heatmap-detail-row-main"));
			mainRow.createSpan({ text: cleanupTitle(event.title), cls: cls("heatmap-detail-title") });

			if (event.type === "timed") {
				const startDt = DateTime.fromISO(event.start);
				mainRow.createSpan({ text: startDt.toFormat("h:mm a"), cls: cls("heatmap-detail-time") });
			} else {
				mainRow.createSpan({ text: "All day", cls: cls("heatmap-detail-time") });
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
		updateLabel();
		legendContainer.empty();
		dayDetailPanel.empty();
		renderHeatmapLegend(legendContainer, dataset.thresholds, config.categoryColor);

		const firstDayOfWeek = bundle.settingsStore.currentSettings.firstDayOfWeek ?? 0;
		renderHeatmapSVG(svgContainer, dataset, {
			mode,
			year,
			month,
			firstDayOfWeek,
			...(config.categoryColor ? { categoryColor: config.categoryColor } : {}),
			onDayClick: (date, events) => showDayDetail(date, events),
		});
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
				ctx.scope.register([], "ArrowLeft", () => {
					handle?.navigate(-1);
					return false;
				});
				ctx.scope.register([], "ArrowRight", () => {
					handle?.navigate(1);
					return false;
				});
			}
		},
		cleanup: () => {
			handle?.destroy();
			handle = null;
		},
	});
}
