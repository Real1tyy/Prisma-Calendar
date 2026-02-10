import { addCls, ColorEvaluator, cls, removeCls } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import { type App, Modal, Setting } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { RECURRENCE_TYPE_OPTIONS } from "../../types/recurring-event";
import { removeZettelId } from "../../utils/calendar-events";
import { normalizeFrontmatterForColorEvaluation } from "../../utils/expression-utils";

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
	private restoreFocusToSearch = false;
	private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private tabsContainer: HTMLElement | null = null;
	private backBtn: HTMLElement | null = null;

	// Recurring tab state
	private hidePastEvents = true;
	private hideSkippedEvents = true;

	// Name/Prop tab state
	private hidePastEventsNameProp = false;
	private hideSkippedEventsNameProp = false;

	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;

	private selectedPropValue: string | null = null;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private nameKey: string | null,
		private propValues: string[] | null,
		private rruleId: string | null
	) {
		super(app);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		// Auto-select when there's exactly one series value
		if (this.propValues && this.propValues.length === 1) {
			this.selectedPropValue = this.propValues[0];
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		addCls(contentEl, "recurring-events-list-modal");

		const tabs = this.getAvailableTabs();
		if (tabs.length === 0) return;

		this.activeTab = tabs[0].id;

		// Render tab buttons only when 2+ sources
		if (tabs.length >= 2) {
			this.tabsContainer = contentEl.createDiv(cls("event-series-tabs"));
			const tabsContainer = this.tabsContainer;
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
		if (this.rruleId != null) tabs.push({ id: "recurring", label: "Recurring" });
		if (this.propValues != null && this.propValues.length > 0) tabs.push({ id: "prop", label: "By Series" });
		if (this.nameKey != null) tabs.push({ id: "name", label: "By Name" });
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
					this.restoreFocusToSearch = true;
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

	private updateBackButton(): void {
		// Remove existing back button
		if (this.backBtn) {
			this.backBtn.remove();
			this.backBtn = null;
		}

		// Show back button in tabs row when viewing a specific series from multiple
		if (
			this.tabsContainer &&
			this.activeTab === "prop" &&
			this.propValues &&
			this.propValues.length > 1 &&
			this.selectedPropValue
		) {
			this.backBtn = this.tabsContainer.createEl("button", {
				text: "\u2190 All series",
				cls: cls("event-series-back-btn"),
			});
			this.backBtn.addEventListener("click", () => {
				this.selectedPropValue = null;
				this.searchQuery = "";
				this.renderContent();
			});
		}
	}

	private renderContent(): void {
		if (!this.contentArea) return;
		this.contentArea.empty();

		// Remove previous categorized styling
		removeCls(this.contentEl, "recurring-events-list-modal-categorized");

		this.updateBackButton();

		if (this.activeTab === "recurring") {
			this.renderRecurringTab();
		} else if (this.activeTab === "name") {
			const nameEvents = this.bundle.seriesManager.getEventsInNameSeries(this.nameKey!);
			const displayName = nameEvents.length > 0 ? removeZettelId(nameEvents[0].title) : this.nameKey!;
			this.renderEventListTab(nameEvents, displayName);
		} else if (this.activeTab === "prop") {
			this.renderPropTab();
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

		// Track input value and debounce search
		this.searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
			this.searchDebounceTimer = setTimeout(() => {
				this.restoreFocusToSearch = true;
				this.renderContent();
			}, 350);
		});

		// Trigger search immediately on Enter
		this.searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
				this.restoreFocusToSearch = true;
				this.renderContent();
			}
		});

		// Trigger search on blur (clicking away)
		this.searchInput.addEventListener("blur", () => {
			// Only re-render if the displayed results don't match current query
			const displayedQuery = this.searchInput?.dataset.appliedQuery ?? "";
			if (displayedQuery !== this.searchQuery) {
				this.renderContent();
			}
		});

		// Restore focus after re-render if needed
		if (this.restoreFocusToSearch) {
			this.restoreFocusToSearch = false;
			this.searchInput.focus();
			this.searchInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
		}

		// Track which query the current render reflects
		this.searchInput.dataset.appliedQuery = this.searchQuery;
	}

	// --- Name / Prop tab ---

	private getEventColor(event: CalendarEvent): string {
		const frontmatter = event.meta ?? {};
		const settings = this.bundle.settingsStore.currentSettings;
		const normalized = normalizeFrontmatterForColorEvaluation(frontmatter, settings.colorRules);
		return this.colorEvaluator.evaluateColor(normalized);
	}

	private renderEventListTab(events: CalendarEvent[], title?: string): void {
		if (!this.contentArea) return;

		// Header (same style as Recurring tab)
		if (title) {
			const header = this.contentArea.createDiv(cls("recurring-events-list-header"));
			const titleEl = header.createEl("h2", { text: title });
			addCls(titleEl, "recurring-events-source-title");
		}

		const now = DateTime.now().toUTC();

		// 1. Statistics (computed from full unfiltered list)
		const pastEvents = events.filter((e) => DateTime.fromISO(e.start, { zone: "utc" }) < now.startOf("day"));
		const totalPast = pastEvents.length;
		const skippedPast = pastEvents.filter((e) => e.skipped).length;
		const completedPast = totalPast - skippedPast;
		const completedPct = totalPast > 0 ? ((completedPast / totalPast) * 100).toFixed(1) : "0.0";

		const statsContainer = this.contentArea.createDiv(cls("recurring-events-stats"));
		statsContainer.createEl("p", {
			text: `Past events: ${totalPast}  \u2022  Skipped: ${skippedPast}  \u2022  Completed: ${completedPct}%`,
			cls: cls("recurring-events-stats-text"),
		});

		// 2. Filter toggles
		const filtersContainer = this.contentArea.createDiv(cls("recurring-events-filters"));

		const hidePastSetting = new Setting(filtersContainer).setName("Hide past events").addToggle((toggle) =>
			toggle.setValue(this.hidePastEventsNameProp).onChange((value) => {
				this.hidePastEventsNameProp = value;
				this.renderContent();
			})
		);
		addCls(hidePastSetting.settingEl, "recurring-events-filter-toggle");

		const hideSkippedSetting = new Setting(filtersContainer).setName("Hide skipped events").addToggle((toggle) =>
			toggle.setValue(this.hideSkippedEventsNameProp).onChange((value) => {
				this.hideSkippedEventsNameProp = value;
				this.renderContent();
			})
		);
		addCls(hideSkippedSetting.settingEl, "recurring-events-filter-toggle");

		// 3. Search input
		this.createSearchInput(this.contentArea);

		// 4. Apply filters
		let filtered = [...events];

		if (this.hidePastEventsNameProp) {
			filtered = filtered.filter((e) => DateTime.fromISO(e.start, { zone: "utc" }) >= now.startOf("day"));
		}

		if (this.hideSkippedEventsNameProp) {
			filtered = filtered.filter((e) => !e.skipped);
		}

		if (this.searchQuery.trim()) {
			const q = this.searchQuery.toLowerCase().trim();
			filtered = filtered.filter((e) => removeZettelId(e.title).toLowerCase().includes(q));
		}

		// Sort: ascending when hiding past (future first), descending otherwise (newest first)
		if (this.hidePastEventsNameProp) {
			filtered.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
		} else {
			filtered.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
		}

		// 5. List container
		const listContainer = this.contentArea.createDiv(cls("recurring-events-list-container"));

		if (filtered.length === 0) {
			const message = "No events found";
			listContainer.createEl("p", { text: message, cls: cls("recurring-events-list-empty") });
			return;
		}

		for (const event of filtered) {
			const row = listContainer.createDiv(cls("recurring-event-row"));

			const eventDate = DateTime.fromISO(event.start, { zone: "utc" });
			if (eventDate < now.startOf("day")) {
				addCls(row, "recurring-event-past");
			}

			// Apply resolved color from color rules
			const color = this.getEventColor(event);
			if (color) {
				row.style.setProperty("--event-color", color);
				addCls(row, "recurring-event-colorized");
			}

			const dateEl = row.createDiv(cls("recurring-event-date"));
			dateEl.textContent = eventDate.toFormat("yyyy-MM-dd (EEE)");

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

	// --- Prop tab ---

	private renderPropTab(): void {
		if (!this.contentArea || !this.propValues || this.propValues.length === 0) return;

		// If multiple series and none selected yet, show chooser
		if (this.propValues.length > 1 && !this.selectedPropValue) {
			this.renderSeriesChooser();
			return;
		}

		const selectedValue = this.selectedPropValue!;

		this.renderEventListTab(this.bundle.seriesManager.getEventsInPropSeries(selectedValue), selectedValue);
	}

	private renderSeriesChooser(): void {
		if (!this.contentArea || !this.propValues) return;

		const header = this.contentArea.createDiv(cls("recurring-events-list-header"));
		header.createEl("h2", {
			text: "Choose a series",
			cls: cls("recurring-events-source-title"),
		});

		const listContainer = this.contentArea.createDiv(cls("recurring-events-list-container"));

		for (const value of this.propValues) {
			const events = this.bundle.seriesManager.getEventsInPropSeries(value);
			const row = listContainer.createDiv(cls("recurring-event-row"));

			const titleEl = row.createDiv(cls("recurring-event-title"));
			titleEl.textContent = value;

			const countEl = row.createDiv(cls("recurring-event-date"));
			countEl.textContent = `${events.length} event${events.length !== 1 ? "s" : ""}`;

			row.onclick = () => {
				this.selectedPropValue = value;
				this.renderContent();
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
			const message = "No instances found";

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
		if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
		this.colorEvaluator.destroy();
		this.contentEl.empty();
	}
}
