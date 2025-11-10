import { aggregateStats, formatDuration } from "../../utils/weekly-stats";
import { StatsModal } from "./base-stats-modal";
import { ChartComponent } from "./chart-component";
import { TableComponent } from "./table-component";

export class AllTimeStatsModal extends StatsModal {
	protected setupKeyboardShortcuts(): void {
		// No keyboard shortcuts for all-time stats (no navigation)
	}

	protected async renderContent(): Promise<void> {
		const { contentEl } = this;

		if (this.contentContainer) {
			this.contentContainer.remove();
		}

		this.contentContainer = contentEl.createDiv("prisma-stats-content");

		const events = await this.bundle.eventStore.getAllEvents();
		const categoryProp = this.bundle.settingsStore.currentSettings.categoryProp || "Category";
		const stats = aggregateStats(events, undefined, undefined, this.aggregationMode, categoryProp);

		this.renderHeader(this.contentContainer, stats);

		if (stats.entries.length === 0) {
			this.contentContainer.createDiv({
				text: "No events found.",
				cls: "prisma-stats-empty",
			});
			return;
		}

		this.chartComponent = new ChartComponent(this.contentContainer, stats.entries, stats.totalDuration);
		this.tableComponent = new TableComponent(this.contentContainer, stats.entries, stats.totalDuration);
	}

	protected getModalTitle(): string {
		return "All-Time Statistics";
	}

	private renderHeader(
		contentEl: HTMLElement,
		stats: { entries: Array<{ count: number }>; totalDuration: number }
	): void {
		const header = contentEl.createDiv("prisma-stats-header");

		const durationStat = header.createDiv("prisma-stats-header-stat");
		durationStat.setText(`⏱ ${formatDuration(stats.totalDuration)}`);

		const middleSection = header.createDiv("prisma-stats-middle-section");

		const titleLabel = middleSection.createDiv("prisma-stats-week-label");
		titleLabel.setText("All Time");

		const eventsStat = header.createDiv("prisma-stats-header-stat");
		eventsStat.setText(`📅 ${stats.entries.reduce((sum, e) => sum + e.count, 0)} events`);
	}
}
