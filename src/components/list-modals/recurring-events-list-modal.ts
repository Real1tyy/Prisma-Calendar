import { DateTime } from "luxon";
import { type App, Modal, Setting } from "obsidian";
import { removeZettelId } from "../../utils/calendar-events";

interface RecurringEventInstance {
	filePath: string;
	instanceDate: DateTime;
	title: string;
	skipped: boolean;
}

export class RecurringEventsListModal extends Modal {
	private instances: RecurringEventInstance[];
	private hidePastEvents = true;
	private hideSkippedEvents = true;
	private contentContainer: HTMLElement | null = null;
	private statsContainer: HTMLElement | null = null;
	private sourceTitle: string;
	private sourceFilePath: string;

	constructor(app: App, instances: RecurringEventInstance[], sourceTitle: string, sourceFilePath: string) {
		super(app);
		this.instances = instances;
		this.sourceTitle = sourceTitle;
		this.sourceFilePath = sourceFilePath;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("recurring-events-list-modal");

		// Header with source title as clickable link
		const header = contentEl.createDiv("recurring-events-list-header");
		const cleanTitle = removeZettelId(this.sourceTitle);
		const titleEl = header.createEl("h2", { text: cleanTitle });
		titleEl.addClass("recurring-events-source-title");
		titleEl.onclick = () => {
			this.app.workspace.openLinkText(this.sourceFilePath, "", false);
			this.close();
		};

		// Statistics container
		this.statsContainer = contentEl.createDiv("recurring-events-stats");

		// Filter toggles container
		const filtersContainer = contentEl.createDiv("recurring-events-filters");

		new Setting(filtersContainer).setName("Hide past events").addToggle((toggle) =>
			toggle.setValue(this.hidePastEvents).onChange((value) => {
				this.hidePastEvents = value;
				this.renderEventsList();
			})
		);

		new Setting(filtersContainer).setName("Hide skipped events").addToggle((toggle) =>
			toggle.setValue(this.hideSkippedEvents).onChange((value) => {
				this.hideSkippedEvents = value;
				this.renderEventsList();
			})
		);

		// Container for events list
		this.contentContainer = contentEl.createDiv("recurring-events-list-container");

		this.renderEventsList();
	}

	private renderEventsList(): void {
		if (!this.contentContainer || !this.statsContainer) return;

		this.contentContainer.empty();
		this.statsContainer.empty();

		const now = DateTime.now().toUTC();

		// Filter out source file from instances
		const allInstancesExcludingSource = [...this.instances].filter(
			(instance) => instance.filePath !== this.sourceFilePath
		);

		// Calculate statistics on PAST instances only
		const pastInstances = allInstancesExcludingSource.filter((instance) => instance.instanceDate < now.startOf("day"));
		const totalPastInstances = pastInstances.length;
		const skippedPastInstances = pastInstances.filter((instance) => instance.skipped).length;
		const completedPastInstances = totalPastInstances - skippedPastInstances;
		const completedPercentage =
			totalPastInstances > 0 ? ((completedPastInstances / totalPastInstances) * 100).toFixed(1) : "0.0";

		// Render statistics
		this.statsContainer.createEl("p", {
			text: `Past events: ${totalPastInstances}  •  Skipped: ${skippedPastInstances}  •  Completed: ${completedPercentage}%`,
			cls: "recurring-events-stats-text",
		});

		// Apply filters
		let filteredInstances = allInstancesExcludingSource;

		if (this.hidePastEvents) {
			filteredInstances = filteredInstances.filter((instance) => instance.instanceDate >= now.startOf("day"));
		}

		if (this.hideSkippedEvents) {
			filteredInstances = filteredInstances.filter((instance) => !instance.skipped);
		}

		// Sort by date (ascending)
		filteredInstances.sort((a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis());

		if (filteredInstances.length === 0) {
			let emptyMessage = "No instances found";
			if (this.hidePastEvents && this.hideSkippedEvents) {
				emptyMessage = "No future non-skipped instances found";
			} else if (this.hidePastEvents) {
				emptyMessage = "No future instances found";
			} else if (this.hideSkippedEvents) {
				emptyMessage = "No non-skipped instances found";
			}

			this.contentContainer.createEl("p", {
				text: emptyMessage,
				cls: "recurring-events-list-empty",
			});
			return;
		}

		// Render each instance as a row
		for (const instance of filteredInstances) {
			const row = this.contentContainer.createDiv("recurring-event-row");

			const dateEl = row.createDiv("recurring-event-date");
			dateEl.textContent = instance.instanceDate.toFormat("yyyy-MM-dd (EEE)");

			const titleEl = row.createDiv("recurring-event-title");
			const cleanTitle = removeZettelId(instance.title);
			titleEl.textContent = cleanTitle;

			// Add skipped indicator if event is skipped (and we're showing skipped events)
			if (instance.skipped && !this.hideSkippedEvents) {
				titleEl.addClass("recurring-event-skipped");
			}

			row.onclick = () => {
				this.app.workspace.openLinkText(instance.filePath, "", false);
				this.close();
			};
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
