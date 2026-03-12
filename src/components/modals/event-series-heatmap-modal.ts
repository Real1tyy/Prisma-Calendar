import { addCls, cls } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import { type App, Modal } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { cleanupTitle } from "../../utils/event-naming";
import { emitHover } from "../../utils/obsidian";
import { getDisplayProperties, renderPropertyValue } from "../../utils/property-display";
import { buildHeatmapDataset, type HeatmapDataset } from "../heatmap/heatmap-data";
import { renderHeatmapLegend, renderHeatmapSVG } from "../heatmap/heatmap-renderer";

export interface EventSeriesHeatmapConfig {
	events: CalendarEvent[];
	title: string;
	categoryColor?: string;
}

type HeatmapMode = "yearly" | "monthly";

export class EventSeriesHeatmapModal extends Modal {
	private dataset!: HeatmapDataset;
	private mode: HeatmapMode = "yearly";
	private year: number;
	private month: number;
	private svgContainer!: HTMLElement;
	private legendContainer!: HTMLElement;
	private controlsLabel!: HTMLElement;
	private dayDetailPanel!: HTMLElement;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private config: EventSeriesHeatmapConfig
	) {
		super(app);
		const now = DateTime.now();
		this.year = now.year;
		this.month = now.month;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		modalEl.addClass(cls("heatmap-modal"));

		const header = contentEl.createDiv(cls("heatmap-header"));
		header.createEl("h2", { text: this.config.title });
		this.renderModeToggle(header);

		this.renderNavControls(contentEl);
		this.legendContainer = contentEl.createDiv(cls("heatmap-legend-container"));
		this.svgContainer = contentEl.createDiv(cls("heatmap-container"));
		this.dayDetailPanel = contentEl.createDiv(cls("heatmap-day-detail"));

		this.dataset = buildHeatmapDataset(this.config.events);
		this.renderView();

		this.scope.register([], "ArrowLeft", () => {
			this.navigate(-1);
			return false;
		});
		this.scope.register([], "ArrowRight", () => {
			this.navigate(1);
			return false;
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderModeToggle(container: HTMLElement): void {
		const modeGroup = container.createDiv(cls("heatmap-mode-group"));
		const yearlyBtn = modeGroup.createEl("button", { text: "Yearly", cls: cls("heatmap-mode-btn") });
		const monthlyBtn = modeGroup.createEl("button", { text: "Monthly", cls: cls("heatmap-mode-btn") });

		addCls(yearlyBtn, "is-active");

		yearlyBtn.addEventListener("click", () => {
			this.mode = "yearly";
			yearlyBtn.className = cls("heatmap-mode-btn");
			addCls(yearlyBtn, "is-active");
			monthlyBtn.className = cls("heatmap-mode-btn");
			this.renderView();
		});

		monthlyBtn.addEventListener("click", () => {
			this.mode = "monthly";
			yearlyBtn.className = cls("heatmap-mode-btn");
			monthlyBtn.className = cls("heatmap-mode-btn");
			addCls(monthlyBtn, "is-active");
			this.renderView();
		});
	}

	private renderNavControls(container: HTMLElement): void {
		const controls = container.createDiv(cls("heatmap-controls"));

		const navGroup = controls.createDiv(cls("heatmap-nav-group"));
		const prevBtn = navGroup.createEl("button", { text: "\u2190", cls: cls("heatmap-nav-btn") });
		this.controlsLabel = navGroup.createSpan(cls("heatmap-nav-label"));
		const nextBtn = navGroup.createEl("button", { text: "\u2192", cls: cls("heatmap-nav-btn") });

		const nowBtn = controls.createEl("button", { text: "Now", cls: cls("heatmap-nav-btn") });

		const shortcutHint = controls.createSpan(cls("heatmap-shortcut-hint"));
		shortcutHint.textContent = "\u2190 \u2192 to navigate";

		prevBtn.addEventListener("click", () => {
			this.navigate(-1);
		});
		nextBtn.addEventListener("click", () => {
			this.navigate(1);
		});
		nowBtn.addEventListener("click", () => {
			const now = DateTime.now();
			this.year = now.year;
			this.month = now.month;
			this.renderView();
		});
	}

	private navigate(direction: number): void {
		if (this.mode === "yearly") {
			this.year += direction;
		} else {
			this.month += direction;
			if (this.month < 1) {
				this.month = 12;
				this.year--;
			} else if (this.month > 12) {
				this.month = 1;
				this.year++;
			}
		}
		this.renderView();
	}

	private renderView(): void {
		this.updateLabel();
		this.legendContainer.empty();
		this.dayDetailPanel.empty();

		renderHeatmapLegend(this.legendContainer, this.dataset.maxCount, this.config.categoryColor);

		const firstDayOfWeek = this.bundle.settingsStore.currentSettings.firstDayOfWeek ?? 0;

		renderHeatmapSVG(this.svgContainer, this.dataset, {
			mode: this.mode,
			year: this.year,
			month: this.month,
			firstDayOfWeek,
			categoryColor: this.config.categoryColor,
			onDayClick: (date, events) => this.showDayDetail(date, events),
		});
	}

	private updateLabel(): void {
		if (this.mode === "yearly") {
			this.controlsLabel.textContent = String(this.year);
		} else {
			const dt = DateTime.local(this.year, this.month, 1);
			this.controlsLabel.textContent = dt.toFormat("LLLL yyyy");
		}
	}

	private showDayDetail(date: string, events: CalendarEvent[]): void {
		this.dayDetailPanel.empty();

		const dt = DateTime.fromISO(date);
		const header = this.dayDetailPanel.createDiv(cls("heatmap-detail-header"));
		header.createEl("h3", { text: dt.toFormat("EEEE, LLLL d, yyyy") });
		header.createSpan({
			text: `${events.length} event${events.length === 1 ? "" : "s"}`,
			cls: cls("heatmap-detail-count"),
		});

		if (events.length === 0) {
			this.dayDetailPanel.createEl("p", {
				text: "No events on this day",
				cls: cls("heatmap-detail-empty"),
			});
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const displayPropertiesList = settings.frontmatterDisplayPropertiesHeatmap;

		const list = this.dayDetailPanel.createDiv(cls("heatmap-detail-list"));
		for (const event of events) {
			const row = list.createDiv(cls("heatmap-detail-row"));

			const mainRow = row.createDiv(cls("heatmap-detail-row-main"));
			mainRow.createSpan({
				text: cleanupTitle(event.title),
				cls: cls("heatmap-detail-title"),
			});

			if (event.type === "timed") {
				const startDt = DateTime.fromISO(event.start);
				mainRow.createSpan({
					text: startDt.toFormat("h:mm a"),
					cls: cls("heatmap-detail-time"),
				});
			} else {
				mainRow.createSpan({
					text: "All day",
					cls: cls("heatmap-detail-time"),
				});
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
							app: this.app,
							linkClassName: cls("prop-link"),
							onLinkClick: () => this.close(),
						});
					}
				}
			}

			row.addEventListener("click", (e) => {
				if (e.ctrlKey || e.metaKey) return;
				void this.app.workspace.openLinkText(event.ref.filePath, "", false);
				this.close();
			});

			row.addEventListener("mouseover", (e) => {
				if (e.ctrlKey || e.metaKey) {
					emitHover(this.app, this.modalEl, row, e, event.ref.filePath, this.bundle.calendarId);
				}
			});
		}
	}
}
