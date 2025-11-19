import { DateTime } from "luxon";
import { type App, Modal, Setting } from "obsidian";
import { removeZettelId } from "../../utils/calendar-events";
import { addCls, cls } from "../../utils/css-utils";

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
	private searchQuery = "";
	private searchInput: HTMLInputElement | null = null;
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
		addCls(contentEl, "recurring-events-list-modal");

		// Header with source title as clickable link
		const header = contentEl.createDiv(cls("recurring-events-list-header"));
		const cleanTitle = removeZettelId(this.sourceTitle);
		const titleEl = header.createEl("h2", { text: cleanTitle });
		addCls(titleEl, "recurring-events-source-title");
		titleEl.onclick = () => {
			this.app.workspace.openLinkText(this.sourceFilePath, "", false);
			this.close();
		};

		// Statistics container
		this.statsContainer = contentEl.createDiv(cls("recurring-events-stats"));

		// Filter toggles container
		const filtersContainer = contentEl.createDiv(cls("recurring-events-filters"));

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

		// Search input
		const searchContainer = contentEl.createDiv(cls("generic-event-list-search"));
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search instances... (Ctrl/Cmd+F)",
			cls: cls("generic-event-search-input"),
		});

		this.searchInput.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			this.searchQuery = target.value;
			this.renderEventsList();
		});

		// Register keyboard shortcuts
		this.registerHotkeys();

		// Container for events list
		this.contentContainer = contentEl.createDiv(cls("recurring-events-list-container"));

		this.renderEventsList();
	}

	private registerHotkeys(): void {
		// Ctrl/Cmd+F to focus search
		this.scope.register(["Mod"], "f", (evt) => {
			evt.preventDefault();
			this.searchInput?.focus();
			this.searchInput?.select();
			return false;
		});

		// Escape to clear search or close modal
		this.scope.register([], "Escape", () => {
			if (this.searchInput && document.activeElement === this.searchInput) {
				if (this.searchInput.value) {
					this.searchInput.value = "";
					this.searchQuery = "";
					this.renderEventsList();
					return false;
				}
				this.searchInput.blur();
				return false;
			}
			this.close();
			return false;
		});
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
			cls: cls("recurring-events-stats-text"),
		});

		// Apply filters
		let filteredInstances = allInstancesExcludingSource;

		if (this.hidePastEvents) {
			filteredInstances = filteredInstances.filter((instance) => instance.instanceDate >= now.startOf("day"));
		}

		if (this.hideSkippedEvents) {
			filteredInstances = filteredInstances.filter((instance) => !instance.skipped);
		}

		// Apply search filter
		if (this.searchQuery.trim()) {
			const normalizedSearch = this.searchQuery.toLowerCase().trim();
			filteredInstances = filteredInstances.filter((instance) => {
				const cleanTitle = removeZettelId(instance.title).toLowerCase();
				return cleanTitle.includes(normalizedSearch);
			});
		}

		// Sort by date (ascending)
		filteredInstances.sort((a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis());

		if (filteredInstances.length === 0) {
			let emptyMessage = "No instances found";
			if (this.searchQuery.trim()) {
				emptyMessage = "No events match your search";
			} else if (this.hidePastEvents && this.hideSkippedEvents) {
				emptyMessage = "No future non-skipped instances found";
			} else if (this.hidePastEvents) {
				emptyMessage = "No future instances found";
			} else if (this.hideSkippedEvents) {
				emptyMessage = "No non-skipped instances found";
			}

			this.contentContainer.createEl("p", {
				text: emptyMessage,
				cls: cls("recurring-events-list-empty"),
			});
			return;
		}

		// Render each instance as a row
		for (const instance of filteredInstances) {
			const row = this.contentContainer.createDiv(cls("recurring-event-row"));

			// Check if event is in the past
			const isPast = instance.instanceDate < now.startOf("day");
			if (isPast) {
				addCls(row, "recurring-event-past");
			}

			const dateEl = row.createDiv(cls("recurring-event-date"));
			dateEl.textContent = instance.instanceDate.toFormat("yyyy-MM-dd (EEE)");

			const titleEl = row.createDiv(cls("recurring-event-title"));
			const cleanTitle = removeZettelId(instance.title);
			titleEl.textContent = cleanTitle;

			// Add skipped indicator if event is skipped (and we're showing skipped events)
			if (instance.skipped && !this.hideSkippedEvents) {
				addCls(titleEl, "recurring-event-skipped");
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
