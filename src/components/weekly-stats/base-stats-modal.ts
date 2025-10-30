import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { ChartComponent } from "./chart-component";
import type { TableComponent } from "./table-component";

export abstract class StatsModal extends Modal {
	protected bundle: CalendarBundle;
	protected chartComponent: ChartComponent | null = null;
	protected tableComponent: TableComponent | null = null;

	constructor(app: App, bundle: CalendarBundle) {
		super(app);
		this.bundle = bundle;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("prisma-weekly-stats-modal");

		this.setupKeyboardShortcuts();
		await this.renderContent();
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
