import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { ParsedEvent } from "../../core/parser";
import { addCls, cls } from "../../utils/css-utils";
import type { AggregationMode } from "../../utils/weekly-stats";
import type { ChartComponent } from "./chart-component";
import type { TableComponent } from "./table-component";

export abstract class StatsModal extends Modal {
	protected bundle: CalendarBundle;
	protected chartComponent: ChartComponent | null = null;
	protected tableComponent: TableComponent | null = null;
	protected aggregationMode: AggregationMode = "name";
	protected includeSkippedEvents = false;
	protected contentContainer: HTMLElement | null = null;

	constructor(app: App, bundle: CalendarBundle) {
		super(app);
		this.bundle = bundle;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		addCls(contentEl, "weekly-stats-modal");

		this.setupKeyboardShortcuts();
		await this.renderContent();
	}

	protected createSkipCheckbox(container: HTMLElement): void {
		const label = container.createEl("label", {
			cls: cls("stats-skip-checkbox-label"),
		});

		const checkbox = label.createEl("input", {
			type: "checkbox",
			cls: cls("stats-skip-checkbox"),
		});
		checkbox.checked = this.includeSkippedEvents;

		label.createSpan({
			text: "Include skipped events",
			cls: cls("stats-skip-checkbox-text"),
		});

		checkbox.addEventListener("change", async () => {
			this.includeSkippedEvents = checkbox.checked;
			this.destroyComponents();
			await this.renderContent();
		});
	}

	protected createAggregationToggle(container: HTMLElement): void {
		container.createEl("span", {
			text: "Group by:",
			cls: cls("stats-mode-label"),
		});

		const toggleButton = container.createEl("button", {
			text: this.aggregationMode === "name" ? "Event Name" : "Category",
			cls: cls("stats-mode-button-compact"),
		});

		toggleButton.addEventListener("click", async () => {
			this.aggregationMode = this.aggregationMode === "name" ? "category" : "name";
			toggleButton.setText(this.aggregationMode === "name" ? "Event Name" : "Category");

			this.destroyComponents();
			await this.renderContent();
		});
	}

	protected filterSkippedEvents(events: ParsedEvent[]): ParsedEvent[] {
		if (this.includeSkippedEvents) {
			return events;
		}
		return events.filter((event) => !event.skipped);
	}

	protected createControlsRow(container: HTMLElement): void {
		const controlsRow = container.createDiv(cls("stats-controls-row"));

		const skipCheckboxContainer = controlsRow.createDiv(cls("stats-skip-checkbox-container"));
		this.createSkipCheckbox(skipCheckboxContainer);

		const aggregationToggle = controlsRow.createDiv(cls("stats-aggregation-toggle"));
		this.createAggregationToggle(aggregationToggle);
	}

	onClose(): void {
		this.destroyComponents();
		const { contentEl } = this;
		contentEl.empty();
	}

	protected abstract setupKeyboardShortcuts(): void;
	protected abstract renderContent(): Promise<void>;
	protected abstract getModalTitle(): string;

	protected destroyComponents(): void {
		this.chartComponent?.destroy();
		this.chartComponent = null;
		this.tableComponent?.destroy();
		this.tableComponent = null;
	}
}
