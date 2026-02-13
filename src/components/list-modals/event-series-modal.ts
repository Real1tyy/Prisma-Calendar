import { addCls, ColorEvaluator, cls, removeCls } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import { type App, Modal, Setting } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { RECURRENCE_TYPE_OPTIONS } from "../../types/recurring-event";
import { removeZettelId } from "../../utils/calendar-events";
import { calculateEventStatistics } from "../../utils/event-statistics";
import { normalizeFrontmatterForColorEvaluation } from "../../utils/expression-utils";
import { EventSeriesBasesViewModal, type EventSeriesBasesViewConfig } from "../modals/event-series-bases-view-modal";
import { EventSeriesTimelineModal } from "../modals/event-series-timeline-modal";

type SourceTab = "name" | "category" | "recurring";

interface TabConfig {
	id: SourceTab;
	label: string;
}

interface EventListItem {
	date: DateTime;
	title: string;
	filePath: string;
	skipped: boolean;
	color?: string;
}

interface EventListOptions {
	title?: string;
	onTitleClick?: () => void;
	hidePast: boolean;
	hideSkipped: boolean;
	onHidePastChange: (value: boolean) => void;
	onHideSkippedChange: (value: boolean) => void;
	beforeStats?: (container: HTMLElement) => void;
}

export class EventSeriesModal extends Modal {
	private activeTab: SourceTab | null = null;
	private searchQuery = "";
	private searchInput: HTMLInputElement | null = null;
	private contentArea: HTMLElement | null = null;
	private restoreFocusToSearch = false;
	private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	private tabsContainer: HTMLElement | null = null;

	// Recurring tab state
	private hidePastEvents = true;
	private hideSkippedEvents = true;

	// Name tab state
	private hidePastEventsNameProp = false;
	private hideSkippedEventsNameProp = false;

	// Category tab state
	private hidePastEventsCategory = false;
	private hideSkippedEventsCategory = false;
	private selectedCategoryValue: string | null = null;

	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private nameKey: string | null,
		private rruleId: string | null,
		private categoryValues: string[] | null = null
	) {
		super(app);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
	}

	onOpen(): void {
		const { contentEl } = this;
		addCls(contentEl, "recurring-events-list-modal");

		const tabs = this.getAvailableTabs();
		if (tabs.length === 0) return;

		this.activeTab = tabs[0].id;

		// If only one category, auto-select it
		if (this.categoryValues && this.categoryValues.length === 1) {
			this.selectedCategoryValue = this.categoryValues[0];
		}

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
					this.selectedCategoryValue = null;
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
		if (this.categoryValues != null && this.categoryValues.length > 0)
			tabs.push({ id: "category", label: "By Category" });
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

	private renderContent(): void {
		if (!this.contentArea) return;
		this.contentArea.empty();

		// Remove previous categorized styling
		removeCls(this.contentEl, "recurring-events-list-modal-categorized");

		// Remove existing bases footer if present
		const existingFooter = this.contentEl.querySelector(`.${cls("event-series-bases-footer")}`);
		if (existingFooter) {
			existingFooter.remove();
		}

		if (this.activeTab === "recurring") {
			this.renderRecurringTab();
			this.renderBasesFooter(this.contentEl);
		} else if (this.activeTab === "category") {
			this.renderCategoryTab();
			// Only render bases footer if a category is selected
			if (this.selectedCategoryValue != null || (this.categoryValues && this.categoryValues.length === 1)) {
				this.renderBasesFooter(this.contentEl);
			}
		} else if (this.activeTab === "name") {
			const nameEvents = this.bundle.nameSeriesTracker.getEventsInNameSeries(this.nameKey!);
			const displayName = nameEvents.length > 0 ? removeZettelId(nameEvents[0].title) : this.nameKey!;
			this.renderEventListTab(nameEvents, displayName);
			this.renderBasesFooter(this.contentEl);
		}
	}

	private renderCategoryTab(): void {
		if (!this.contentArea || !this.categoryValues) return;

		if (this.categoryValues.length === 1 || this.selectedCategoryValue != null) {
			const categoryValue = this.selectedCategoryValue ?? this.categoryValues[0];
			const events = this.bundle.categoryTracker.getEventsWithCategory(categoryValue);

			// Apply category color to modal background
			const categoryColor = this.bundle.categoryTracker.getCategoryColor(categoryValue);
			if (categoryColor) {
				this.contentEl.style.setProperty("--source-category-color", categoryColor);
				addCls(this.contentEl, "recurring-events-list-modal-categorized");
			}

			// Show back button when multiple categories available
			if (this.categoryValues.length > 1) {
				const backBtn = this.contentArea.createEl("button", {
					text: "\u2190 Back to categories",
					cls: cls("event-series-back-btn"),
				});
				backBtn.addEventListener("click", () => {
					this.selectedCategoryValue = null;
					this.renderContent();
				});
			}

			this.renderEventListTab(events, categoryValue);
		} else {
			this.renderCategoryChooser();
		}
	}

	private renderCategoryChooser(): void {
		if (!this.contentArea || !this.categoryValues) return;

		this.contentArea.createEl("h3", { text: "Select a category" });

		const listContainer = this.contentArea.createDiv(cls("generic-event-list"));
		for (const categoryValue of this.categoryValues) {
			const events = this.bundle.categoryTracker.getEventsWithCategory(categoryValue);
			const itemEl = listContainer.createDiv(cls("generic-event-list-item"));

			const infoEl = itemEl.createDiv(cls("generic-event-info"));
			infoEl.createEl("div", { cls: cls("generic-event-title") }).textContent = categoryValue;
			infoEl.createEl("div", { cls: cls("generic-event-subtitle") }).textContent =
				`${events.length} event${events.length === 1 ? "" : "s"}`;

			itemEl.addEventListener("click", () => {
				this.selectedCategoryValue = categoryValue;
				this.renderContent();
			});
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

	// --- Shared rendering ---

	private getEventColor(event: CalendarEvent): string {
		const frontmatter = event.meta ?? {};
		const settings = this.bundle.settingsStore.currentSettings;
		const normalized = normalizeFrontmatterForColorEvaluation(frontmatter, settings.colorRules);
		return this.colorEvaluator.evaluateColor(normalized);
	}

	private renderEventList(items: EventListItem[], options: EventListOptions): void {
		if (!this.contentArea) return;

		// Header
		if (options.title) {
			const header = this.contentArea.createDiv(cls("recurring-events-list-header"));
			const titleEl = header.createEl("h2", { text: options.title });
			addCls(titleEl, "recurring-events-source-title");
			if (options.onTitleClick) {
				titleEl.onclick = options.onTitleClick;
			}
		}

		// Extra content before stats (e.g., recurrence info)
		options.beforeStats?.(this.contentArea);

		const now = DateTime.now().toUTC();

		const stats = calculateEventStatistics(items, now);

		const statsContainer = this.contentArea.createDiv(cls("recurring-events-stats"));

		// Main statistics row
		statsContainer.createEl("p", {
			text: `Total: ${stats.total}  \u2022  Past: ${stats.past}  \u2022  Skipped: ${stats.skipped}  \u2022  Completed: ${stats.completedPercentage}%`,
			cls: cls("recurring-events-stats-text"),
		});

		const timeBreakdownParts = [
			`This year: ${stats.thisYear}`,
			`This month: ${stats.thisMonth}`,
			`This week: ${stats.thisWeek}`,
		];
		if (stats.frequency) {
			timeBreakdownParts.push(`Frequency: ${stats.frequency}`);
		}

		statsContainer.createEl("p", {
			text: timeBreakdownParts.join("  \u2022  "),
			cls: cls("recurring-events-stats-text-secondary"),
		});

		// Filter toggles
		const filtersContainer = this.contentArea.createDiv(cls("recurring-events-filters"));

		const hidePastSetting = new Setting(filtersContainer).setName("Hide past events").addToggle((toggle) =>
			toggle.setValue(options.hidePast).onChange((value) => {
				options.onHidePastChange(value);
				this.renderContent();
			})
		);
		addCls(hidePastSetting.settingEl, "recurring-events-filter-toggle");

		const hideSkippedSetting = new Setting(filtersContainer).setName("Hide skipped events").addToggle((toggle) =>
			toggle.setValue(options.hideSkipped).onChange((value) => {
				options.onHideSkippedChange(value);
				this.renderContent();
			})
		);
		addCls(hideSkippedSetting.settingEl, "recurring-events-filter-toggle");

		// Search input
		this.createSearchInput(this.contentArea);

		// Apply filters
		let filtered = [...items];

		if (options.hidePast) {
			filtered = filtered.filter((item) => item.date >= now.startOf("day"));
		}

		if (options.hideSkipped) {
			filtered = filtered.filter((item) => !item.skipped);
		}

		if (this.searchQuery.trim()) {
			const q = this.searchQuery.toLowerCase().trim();
			filtered = filtered.filter((item) => item.title.toLowerCase().includes(q));
		}

		// Sort: ascending when hiding past (future first), descending otherwise
		if (options.hidePast) {
			filtered.sort((a, b) => a.date.toMillis() - b.date.toMillis());
		} else {
			filtered.sort((a, b) => b.date.toMillis() - a.date.toMillis());
		}

		// List container
		const listContainer = this.contentArea.createDiv(cls("recurring-events-list-container"));

		if (filtered.length === 0) {
			listContainer.createEl("p", { text: "No events found", cls: cls("recurring-events-list-empty") });
			return;
		}

		for (const item of filtered) {
			const row = listContainer.createDiv(cls("recurring-event-row"));

			if (item.date < now.startOf("day")) {
				addCls(row, "recurring-event-past");
			}

			if (item.color) {
				row.style.setProperty("--event-color", item.color);
				addCls(row, "recurring-event-colorized");
			}

			const dateEl = row.createDiv(cls("recurring-event-date"));
			dateEl.textContent = item.date.toFormat("yyyy-MM-dd (EEE)");

			const titleEl = row.createDiv(cls("recurring-event-title"));
			titleEl.textContent = item.title;

			if (item.skipped) {
				addCls(titleEl, "recurring-event-skipped");
			}

			row.onclick = () => {
				void this.app.workspace.openLinkText(item.filePath, "", false);
				this.close();
			};
		}
	}

	// --- Name / Category tab ---

	private renderEventListTab(events: CalendarEvent[], title?: string): void {
		if (!this.contentArea) return;

		const isCategory = this.activeTab === "category";

		const items: EventListItem[] = events.map((event) => ({
			date: DateTime.fromISO(event.start, { zone: "utc" }),
			title: removeZettelId(event.title),
			filePath: event.ref.filePath,
			skipped: !!event.skipped,
			color: isCategory ? undefined : this.getEventColor(event),
		}));

		this.renderEventList(items, {
			title,
			hidePast: isCategory ? this.hidePastEventsCategory : this.hidePastEventsNameProp,
			hideSkipped: isCategory ? this.hideSkippedEventsCategory : this.hideSkippedEventsNameProp,
			onHidePastChange: (v) => {
				if (isCategory) {
					this.hidePastEventsCategory = v;
				} else {
					this.hidePastEventsNameProp = v;
				}
			},
			onHideSkippedChange: (v) => {
				if (isCategory) {
					this.hideSkippedEventsCategory = v;
				} else {
					this.hideSkippedEventsNameProp = v;
				}
			},
		});
	}

	// --- Recurring tab ---

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

		// Normalize instances to EventListItems (excluding source file)
		const items: EventListItem[] = [...series.instances]
			.filter((instance) => instance.event.ref.filePath !== series.sourceFilePath)
			.map((instance) => ({
				date: instance.instanceDate,
				title: removeZettelId(instance.event.title),
				filePath: instance.event.ref.filePath,
				skipped: !!instance.event.skipped,
			}));

		this.renderEventList(items, {
			title: removeZettelId(series.sourceTitle),
			onTitleClick: () => {
				void this.app.workspace.openLinkText(series.sourceFilePath, "", false);
				this.close();
			},
			hidePast: this.hidePastEvents,
			hideSkipped: this.hideSkippedEvents,
			onHidePastChange: (v) => {
				this.hidePastEvents = v;
			},
			onHideSkippedChange: (v) => {
				this.hideSkippedEvents = v;
			},
			beforeStats: (container) => {
				if (!series.rruleType) return;
				const infoContainer = container.createDiv(cls("recurring-events-info"));
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
			},
		});
	}

	// --- Bases footer ---

	private renderBasesFooter(container: HTMLElement): void {
		const footer = container.createDiv(cls("event-series-bases-footer"));

		const buttonsContainer = footer.createDiv(cls("event-series-bases-footer-buttons"));
		const viewTypes = ["table", "list", "cards", "timeline"] as const;

		for (const viewType of viewTypes) {
			const btn = buttonsContainer.createEl("button", {
				text: viewType.charAt(0).toUpperCase() + viewType.slice(1),
				cls: cls("event-series-bases-btn"),
			});

			if (viewType === "timeline") {
				btn.addEventListener("click", () => this.openTimelineView());
			} else {
				btn.addEventListener("click", () => this.openBasesView(viewType));
			}
		}
	}

	private openTimelineView(): void {
		let events: CalendarEvent[] = [];
		let title = "";

		if (this.activeTab === "recurring" && this.rruleId) {
			const series = this.bundle.recurringEventManager.getRecurringEventSeries(this.rruleId);
			if (series) {
				events = series.instances.map((instance) => instance.event);
				const displayName = removeZettelId(series.sourceTitle);
				title = `Timeline for Recurring - ${displayName}`;
			}
		} else if (this.activeTab === "name" && this.nameKey) {
			events = this.bundle.nameSeriesTracker.getEventsInNameSeries(this.nameKey);
			const displayName = events.length > 0 ? removeZettelId(events[0].title) : this.nameKey;
			title = `Timeline for Name - ${displayName}`;
		} else if (this.activeTab === "category") {
			const categoryValue =
				this.selectedCategoryValue ?? (this.categoryValues?.length === 1 ? this.categoryValues[0] : null);
			if (categoryValue) {
				events = this.bundle.categoryTracker.getEventsWithCategory(categoryValue);
				title = `Timeline for Category - ${categoryValue}`;
			}
		}

		if (events.length > 0) {
			new EventSeriesTimelineModal(this.app, this.bundle, { events, title }).open();
		}
	}

	private openBasesView(viewType: "table" | "cards" | "list"): void {
		const settings = this.bundle.settingsStore.currentSettings;
		let config: EventSeriesBasesViewConfig;

		if (this.activeTab === "recurring") {
			if (!this.rruleId) return;
			const series = this.bundle.recurringEventManager.getRecurringEventSeries(this.rruleId);
			const displayTitle = series ? removeZettelId(series.sourceTitle) : this.rruleId;
			config = {
				mode: "recurring",
				filterValue: this.rruleId,
				displayTitle,
				viewType,
			};
		} else if (this.activeTab === "name") {
			if (!this.nameKey) return;
			const nameEvents = this.bundle.nameSeriesTracker.getEventsInNameSeries(this.nameKey);
			const displayTitle = nameEvents.length > 0 ? removeZettelId(nameEvents[0].title) : this.nameKey;
			config = {
				mode: "name",
				filterValue: displayTitle,
				displayTitle,
				viewType,
			};
		} else if (this.activeTab === "category") {
			const categoryValue =
				this.selectedCategoryValue ?? (this.categoryValues?.length === 1 ? this.categoryValues[0] : null);
			if (!categoryValue) return;
			config = {
				mode: "category",
				filterValue: categoryValue,
				viewType,
			};
		} else {
			return;
		}

		new EventSeriesBasesViewModal(this.app, settings, config).open();
	}

	onClose(): void {
		if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
		this.colorEvaluator.destroy();
		this.contentEl.empty();
	}
}
