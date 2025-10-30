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
		contentEl.empty();

		const events = await this.bundle.eventStore.getAllEvents();
		const stats = aggregateStats(events);

		this.renderHeader(contentEl, stats);

		if (stats.entries.length === 0) {
			contentEl.createDiv({
				text: "No events found.",
				cls: "prisma-stats-empty",
			});
			return;
		}

		this.chartComponent = new ChartComponent(contentEl, stats.entries, stats.totalDuration);
		this.tableComponent = new TableComponent(contentEl, stats.entries, stats.totalDuration);
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
