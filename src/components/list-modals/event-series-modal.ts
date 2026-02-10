import { addCls, cls, removeCls } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import { type App, Modal, Setting } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import {
	RECURRENCE_TYPE_OPTIONS,
	type RecurringEventInstance,
	type RecurringEventSeries,
	type RecurrenceType,
} from "../../types/recurring-event";
import { removeZettelId } from "../../utils/calendar-events";
import { formatEventTimeInfo } from "../../utils/time-formatter";

type SourceTab = "name" | "prop" | "recurring";

interface TabConfig {
	id: SourceTab;
	label: string;
}

export class EventSeriesModal extends Modal {
	private activeTab: SourceTab | null = null;
	private searchQuery = "";
	private searchInput: HTMLInputElement | null = null;
	private contentArea: HTMLElement | null = null;

	// Recurring tab state
	private hidePastEvents = true;
	private hideSkippedEvents = true;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private nameKey: string | null,
		private propValue: string | null,
		private rruleId: string | null
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		addCls(contentEl, "recurring-events-list-modal");

		const tabs = this.getAvailableTabs();
		if (tabs.length === 0) return;

		this.activeTab = tabs[0].id;

		// Render tab buttons only when 2+ sources
		if (tabs.length >= 2) {
			const tabsContainer = contentEl.createDiv(cls("event-series-tabs"));
			for (const tab of tabs) {
				const btn = tabsContainer.createEl("button", {
					text: tab.label,
					cls: cls("event-series-tab-btn"),
				});
				if (tab.id === this.activeTab) {
					addCls(btn, "is-active");
				}
				btn.addEventListener("click", () => {
					this.activeTab = tab.id;
					tabsContainer.querySelectorAll(`.${cls("event-series-tab-btn")}`).forEach((b) => {
						removeCls(b as HTMLElement, "is-active");
					});
					addCls(btn, "is-active");
					this.renderContent();
				});
			}
		}

		// Single content area — everything below tabs re-renders on tab switch
		this.contentArea = contentEl.createDiv();

		this.registerHotkeys();
		this.renderContent();
	}

	private getAvailableTabs(): TabConfig[] {
		const tabs: TabConfig[] = [];
		if (this.nameKey != null) tabs.push({ id: "name", label: "By Name" });
		if (this.propValue != null) tabs.push({ id: "prop", label: "By Series" });
		if (this.rruleId != null) tabs.push({ id: "recurring", label: "Recurring" });
		return tabs;
	}

	private registerHotkeys(): void {
		this.scope.register(["Mod"], "f", (evt) => {
			evt.preventDefault();
			this.searchInput?.focus();
			this.searchInput?.select();
			return false;
		});

		this.scope.register([], "Escape", () => {
			if (this.searchInput && document.activeElement === this.searchInput) {
				if (this.searchInput.value) {
					this.searchInput.value = "";
					this.searchQuery = "";
					this.renderContent();
					return false;
				}
				this.searchInput.blur();
				return false;
			}
			this.close();
			return false;
		});
	}

	private renderContent(): void {
		if (!this.contentArea) return;
		this.contentArea.empty();

		// Remove previous categorized styling
		removeCls(this.contentEl, "recurring-events-list-modal-categorized");

		if (this.activeTab === "recurring") {
			this.renderRecurringTab();
		} else if (this.activeTab === "name") {
			this.renderEventListTab(this.bundle.seriesManager.getEventsInNameSeries(this.nameKey!));
		} else if (this.activeTab === "prop") {
			this.renderEventListTab(this.bundle.seriesManager.getEventsInPropSeries(this.propValue!));
		}
	}

	// --- Shared: search input (created fresh each render) ---

	private createSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv(cls("generic-event-list-search"));
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search instances... (Ctrl/Cmd+F)",
			cls: cls("generic-event-search-input"),
		});
		this.searchInput.value = this.searchQuery;

		this.searchInput.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			this.searchQuery = target.value;
			this.renderContent();
		});
	}

	// --- Name / Prop tab ---

	private renderEventListTab(events: CalendarEvent[]): void {
		if (!this.contentArea) return;

		// Search input
		this.createSearchInput(this.contentArea);

		// Apply search filter
		let filtered = events;
		if (this.searchQuery.trim()) {
			const q = this.searchQuery.toLowerCase().trim();
			filtered = filtered.filter((e) => removeZettelId(e.title).toLowerCase().includes(q));
		}

		// Sort by start date, newest first
		filtered = [...filtered].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

		// List container
		const listContainer = this.contentArea.createDiv(cls("recurring-events-list-container"));

		if (filtered.length === 0) {
			listContainer.createEl("p", {
				text: this.searchQuery.trim() ? "No events match your search" : "No events found",
				cls: cls("recurring-events-list-empty"),
			});
			return;
		}

		const now = DateTime.now().toUTC();

		for (const event of filtered) {
			const row = listContainer.createDiv(cls("recurring-event-row"));

			const eventDate = DateTime.fromISO(event.start, { zone: "utc" });
			if (eventDate < now.startOf("day")) {
				addCls(row, "recurring-event-past");
			}

			const dateEl = row.createDiv(cls("recurring-event-date"));
			dateEl.textContent = formatEventTimeInfo(event);

			const titleEl = row.createDiv(cls("recurring-event-title"));
			titleEl.textContent = removeZettelId(event.title);

			if (event.skipped) {
				addCls(titleEl, "recurring-event-skipped");
			}

			row.onclick = () => {
				void this.app.workspace.openLinkText(event.ref.filePath, "", false);
				this.close();
			};
		}
	}

	// --- Recurring tab (matches RecurringEventsListModal layout exactly) ---
	// Order: title → recurrence info → stats → filters → search → list

	private renderRecurringTab(): void {
		if (!this.contentArea || !this.rruleId) return;

		const series = this.bundle.recurringEventManager.getRecurringEventSeries(this.rruleId);
		if (!series) {
			this.contentArea.createEl("p", {
				text: "Recurring event series not found",
				cls: cls("recurring-events-list-empty"),
			});
			return;
		}

		// Apply category color to modal background
		if (series.sourceCategory) {
			this.contentEl.style.setProperty("--source-category-color", series.sourceCategory);
			addCls(this.contentEl, "recurring-events-list-modal-categorized");
		}

		// 1. Header with source title as clickable link
		const header = this.contentArea.createDiv(cls("recurring-events-list-header"));
		const cleanTitle = removeZettelId(series.sourceTitle);
		const titleEl = header.createEl("h2", { text: cleanTitle });
		addCls(titleEl, "recurring-events-source-title");
		titleEl.onclick = () => {
			void this.app.workspace.openLinkText(series.sourceFilePath, "", false);
			this.close();
		};

		// 2. Recurrence info
		if (series.rruleType) {
			const infoContainer = this.contentArea.createDiv(cls("recurring-events-info"));
			const typeLabel = RECURRENCE_TYPE_OPTIONS[series.rruleType] || series.rruleType;
			let infoText = `Recurrence: ${typeLabel}`;

			if (series.rruleSpec && (series.rruleType === "weekly" || series.rruleType === "bi-weekly")) {
				const days = series.rruleSpec
					.split(",")
					.map((day) => day.trim())
					.map((day) => day.charAt(0).toUpperCase() + day.slice(1))
					.join(", ");
				infoText += ` \u2022 Days: ${days}`;
			}

			infoContainer.createEl("p", {
				text: infoText,
				cls: cls("recurring-events-info-text"),
			});
		}

		const now = DateTime.now().toUTC();

		// Filter out source file from instances
		const allInstancesExcludingSource = [...series.instances].filter(
			(instance) => instance.event.ref.filePath !== series.sourceFilePath
		);

		// Calculate statistics on PAST instances only
		const pastInstances = allInstancesExcludingSource.filter((instance) => instance.instanceDate < now.startOf("day"));
		const totalPastInstances = pastInstances.length;
		const skippedPastInstances = pastInstances.filter((instance) => instance.event.skipped).length;
		const completedPastInstances = totalPastInstances - skippedPastInstances;
		const completedPercentage =
			totalPastInstances > 0 ? ((completedPastInstances / totalPastInstances) * 100).toFixed(1) : "0.0";

		// 3. Statistics
		const statsContainer = this.contentArea.createDiv(cls("recurring-events-stats"));
		statsContainer.createEl("p", {
			text: `Past events: ${totalPastInstances}  \u2022  Skipped: ${skippedPastInstances}  \u2022  Completed: ${completedPercentage}%`,
			cls: cls("recurring-events-stats-text"),
		});

		// 4. Filter toggles
		const filtersContainer = this.contentArea.createDiv(cls("recurring-events-filters"));

		const hidePastSetting = new Setting(filtersContainer).setName("Hide past events").addToggle((toggle) =>
			toggle.setValue(this.hidePastEvents).onChange((value) => {
				this.hidePastEvents = value;
				this.renderContent();
			})
		);
		addCls(hidePastSetting.settingEl, "recurring-events-filter-toggle");

		const hideSkippedSetting = new Setting(filtersContainer).setName("Hide skipped events").addToggle((toggle) =>
			toggle.setValue(this.hideSkippedEvents).onChange((value) => {
				this.hideSkippedEvents = value;
				this.renderContent();
			})
		);
		addCls(hideSkippedSetting.settingEl, "recurring-events-filter-toggle");

		// 5. Search input
		this.createSearchInput(this.contentArea);

		// 6. Apply filters and render list
		let filteredInstances = allInstancesExcludingSource;

		if (this.hidePastEvents) {
			filteredInstances = filteredInstances.filter((instance) => instance.instanceDate >= now.startOf("day"));
		}

		if (this.hideSkippedEvents) {
			filteredInstances = filteredInstances.filter((instance) => !instance.event.skipped);
		}

		// Apply search filter
		if (this.searchQuery.trim()) {
			const normalizedSearch = this.searchQuery.toLowerCase().trim();
			filteredInstances = filteredInstances.filter((instance) => {
				const title = removeZettelId(instance.event.title).toLowerCase();
				return title.includes(normalizedSearch);
			});
		}

		// Sort by date: ascending when showing future events, descending when showing past events
		if (this.hidePastEvents) {
			filteredInstances.sort((a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis());
		} else {
			filteredInstances.sort((a, b) => b.instanceDate.toMillis() - a.instanceDate.toMillis());
		}

		// List container
		const listContainer = this.contentArea.createDiv(cls("recurring-events-list-container"));

		if (filteredInstances.length === 0) {
			let message = "No instances found";
			if (this.searchQuery.trim()) {
				message = "No events match your search";
			} else if (this.hidePastEvents && this.hideSkippedEvents) {
				message = "No future non-skipped instances found";
			} else if (this.hidePastEvents) {
				message = "No future instances found";
			} else if (this.hideSkippedEvents) {
				message = "No non-skipped instances found";
			}

			listContainer.createEl("p", {
				text: message,
				cls: cls("recurring-events-list-empty"),
			});
			return;
		}

		for (const instance of filteredInstances) {
			const row = listContainer.createDiv(cls("recurring-event-row"));

			const isPast = instance.instanceDate < now.startOf("day");
			if (isPast) {
				addCls(row, "recurring-event-past");
			}

			const dateEl = row.createDiv(cls("recurring-event-date"));
			dateEl.textContent = instance.instanceDate.toFormat("yyyy-MM-dd (EEE)");

			const titleEl = row.createDiv(cls("recurring-event-title"));
			titleEl.textContent = removeZettelId(instance.event.title);

			if (instance.event.skipped && !this.hideSkippedEvents) {
				addCls(titleEl, "recurring-event-skipped");
			}

			row.onclick = () => {
				void this.app.workspace.openLinkText(instance.event.ref.filePath, "", false);
				this.close();
			};
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
