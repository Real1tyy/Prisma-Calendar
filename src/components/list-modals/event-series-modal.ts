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

		// Statistics (computed from full unfiltered list)
		const pastItems = items.filter((item) => item.date < now.startOf("day"));
		const totalPast = pastItems.length;
		const skippedPast = pastItems.filter((item) => item.skipped).length;
		const completedPast = totalPast - skippedPast;
		const completedPct = totalPast > 0 ? ((completedPast / totalPast) * 100).toFixed(1) : "0.0";

		const statsContainer = this.contentArea.createDiv(cls("recurring-events-stats"));
		statsContainer.createEl("p", {
			text: `Total: ${items.length}  \u2022  Past: ${totalPast}  \u2022  Skipped: ${skippedPast}  \u2022  Completed: ${completedPct}%`,
			cls: cls("recurring-events-stats-text"),
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

	// --- Name / Prop tab ---

	private renderEventListTab(events: CalendarEvent[], title?: string): void {
		if (!this.contentArea) return;

		const items: EventListItem[] = events.map((event) => ({
			date: DateTime.fromISO(event.start, { zone: "utc" }),
			title: removeZettelId(event.title),
			filePath: event.ref.filePath,
			skipped: !!event.skipped,
			color: this.getEventColor(event),
		}));

		this.renderEventList(items, {
			title,
			hidePast: this.hidePastEventsNameProp,
			hideSkipped: this.hideSkippedEventsNameProp,
			onHidePastChange: (v) => {
				this.hidePastEventsNameProp = v;
			},
			onHideSkippedChange: (v) => {
				this.hideSkippedEventsNameProp = v;
			},
		});
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

	onClose(): void {
		if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
		this.colorEvaluator.destroy();
		this.contentEl.empty();
	}
}
