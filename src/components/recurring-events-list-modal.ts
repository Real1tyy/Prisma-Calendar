import { DateTime } from "luxon";
import { type App, Modal, Setting } from "obsidian";

interface RecurringEventInstance {
	filePath: string;
	instanceDate: DateTime;
	title: string;
}

export class RecurringEventsListModal extends Modal {
	private instances: RecurringEventInstance[];
	private hidePastEvents = true;
	private contentContainer: HTMLElement | null = null;
	private sourceTitle: string;

	constructor(app: App, instances: RecurringEventInstance[], sourceTitle: string) {
		super(app);
		this.instances = instances;
		this.sourceTitle = sourceTitle;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("recurring-events-list-modal");

		// Header
		const header = contentEl.createDiv("recurring-events-list-header");
		// Remove ZettelID from title if it exists
		const cleanTitle = this.sourceTitle.replace(/-\d{14}$/, "");
		header.createEl("h2", { text: `Recurring Event Instances: ${cleanTitle}` });

		// Filter toggle
		new Setting(contentEl)
			.setName("Hide past events")
			.setDesc("Only show future occurrences")
			.addToggle((toggle) =>
				toggle.setValue(this.hidePastEvents).onChange((value) => {
					this.hidePastEvents = value;
					this.renderEventsList();
				})
			);

		// Container for events list
		this.contentContainer = contentEl.createDiv("recurring-events-list-container");

		this.renderEventsList();
	}

	private renderEventsList(): void {
		if (!this.contentContainer) return;

		this.contentContainer.empty();

		const now = DateTime.now();

		// Filter and sort instances
		let filteredInstances = [...this.instances];

		if (this.hidePastEvents) {
			filteredInstances = filteredInstances.filter((instance) => instance.instanceDate >= now.startOf("day"));
		}

		// Sort by date (ascending)
		filteredInstances.sort((a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis());

		if (filteredInstances.length === 0) {
			this.contentContainer.createEl("p", {
				text: this.hidePastEvents ? "No future instances found" : "No instances found",
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
			const cleanTitle = instance.title.replace(/-\d{14}$/, "");
			titleEl.textContent = cleanTitle;

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
