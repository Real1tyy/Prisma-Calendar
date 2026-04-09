import { addCls, cls, removeCls } from "@real1ty-obsidian-plugins";
import type { Modifier } from "obsidian";
import { type App, Modal, Notice } from "obsidian";

import { FULL_COMMAND_IDS } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { assignCategories, toggleSkip } from "../../core/commands";
import {
	formatRecurrenceLabel,
	isPresetType,
	type NodeRecurringEvent,
	RECURRENCE_TYPE_OPTIONS,
} from "../../types/recurring-event";
import { getEventName, removeZettelId } from "../../utils/event-naming";
import { getCategoriesFromFilePath, openFileInNewTab } from "../../utils/obsidian";
import { getStartDateTime } from "../../utils/recurring-utils";
import type { CalendarComponent } from "../calendar-view";
import { openCategoryAssignModal } from "../modals";
import { EventSeriesModal } from "./event-series-modal";

type TabId = "recurring" | "byCategory" | "byName";

type SortMode = "count-desc" | "count-asc" | "name-asc" | "name-desc";

const SORT_OPTIONS: Record<SortMode, string> = {
	"count-desc": "Count ↓",
	"count-asc": "Count ↑",
	"name-asc": "Name A→Z",
	"name-desc": "Name Z→A",
};

const RECURRENCE_TYPE_FILTER_OPTIONS = {
	all: "All Types",
	...RECURRENCE_TYPE_OPTIONS,
	custom: "Custom Interval",
} as const;

interface RecurringListItem {
	filePath: string;
	title: string;
	recurrenceType: string;
	categories: string[];
	instanceCount: number;
	rruleId: string;
}

interface SimpleListItem {
	key: string;
	title: string;
	count: number;
	onClick: () => void;
}

export class EventsModal extends Modal {
	// ─── Lifecycle ───────────────────────────────────────────────
	private activeTab: TabId = "recurring";
	private sortMode: SortMode = "count-desc";
	private searchQuery = "";
	private searchInput!: HTMLInputElement;
	private contentArea!: HTMLElement;
	private tabButtons: Map<TabId, HTMLButtonElement> = new Map();

	// Recurring tab state
	private showDisabledOnly = false;
	private selectedTypeFilter: keyof typeof RECURRENCE_TYPE_FILTER_OPTIONS = "all";
	private enabledEvents: NodeRecurringEvent[] = [];
	private disabledEvents: NodeRecurringEvent[] = [];

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private calendarComponent: CalendarComponent
	) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		addCls(contentEl, "generic-event-list-modal");

		this.enabledEvents = this.bundle.recurringEventManager.getEnabledRecurringEvents();
		this.disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();

		// Determine initial tab based on available data
		const recurringCount = this.enabledEvents.length + this.disabledEvents.length;
		const categoryCount = this.bundle.categoryTracker.getCategories().length;
		const nameSeriesEnabled = this.bundle.settingsStore.currentSettings.enableNameSeriesTracking;
		const nameCount = nameSeriesEnabled ? this.bundle.nameSeriesTracker.getNameBasedSeries().size : 0;

		if (recurringCount > 0) {
			this.activeTab = "recurring";
		} else if (categoryCount > 0) {
			this.activeTab = "byCategory";
		} else if (nameCount > 0) {
			this.activeTab = "byName";
		}

		// Title
		contentEl.createEl("h2", { text: "Events" });

		// Tab bar
		const tabBar = contentEl.createDiv(cls("event-series-tabs"));
		this.createTabButton(tabBar, "recurring", `Recurring (${recurringCount})`);
		this.createTabButton(tabBar, "byCategory", `By Category (${categoryCount})`);
		if (nameSeriesEnabled) {
			this.createTabButton(tabBar, "byName", `By Name (${nameCount})`);
		}

		// Search + sort row
		const searchContainer = contentEl.createDiv(cls("generic-event-list-search"));
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search events... (Ctrl/Cmd+F)",
			cls: cls("generic-event-search-input"),
		});
		this.searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.renderContent();
		});

		const sortSelect = searchContainer.createEl("select", {
			cls: cls("events-modal-sort-select"),
		});
		for (const [value, label] of Object.entries(SORT_OPTIONS)) {
			const option = sortSelect.createEl("option", { text: label, value });
			option.value = value;
		}
		sortSelect.value = this.sortMode;
		sortSelect.addEventListener("change", (e) => {
			this.sortMode = (e.target as HTMLSelectElement).value as SortMode;
			this.renderContent();
		});

		setTimeout(() => {
			this.searchInput.focus();
		}, 50);

		// Content area
		this.contentArea = contentEl.createDiv(cls("events-modal-content"));

		this.registerHotkeys();
		this.renderContent();
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	// ─── Tab Setup ───────────────────────────────────────────────

	private createTabButton(container: HTMLElement, tabId: TabId, label: string): void {
		const btn = container.createEl("button", {
			text: label,
			cls: cls("event-series-tab-btn"),
		});
		if (tabId === this.activeTab) {
			addCls(btn, "is-active");
		}
		btn.addEventListener("click", () => {
			this.activeTab = tabId;
			for (const [id, tabBtn] of this.tabButtons) {
				if (id === tabId) {
					addCls(tabBtn, "is-active");
				} else {
					removeCls(tabBtn, "is-active");
				}
			}
			this.renderContent();
		});
		this.tabButtons.set(tabId, btn);
	}

	private registerHotkeys(): void {
		this.scope.register(["Mod"], "f", (evt) => {
			evt.preventDefault();
			this.searchInput.focus();
			this.searchInput.select();
			return false;
		});

		this.scope.register([], "Escape", () => {
			if (document.activeElement === this.searchInput) {
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

		const hotkeyCommandId = FULL_COMMAND_IDS.SHOW_RECURRING_EVENTS;
		if (hotkeyCommandId) {
			const appWithHotkeys = this.app as unknown as {
				hotkeyManager?: {
					getHotkeys: (id: string) => Array<{ modifiers: Modifier[]; key: string }>;
				};
			};
			const hotkeys = appWithHotkeys.hotkeyManager?.getHotkeys(hotkeyCommandId);
			if (hotkeys && hotkeys.length > 0) {
				for (const hotkey of hotkeys) {
					this.scope.register(hotkey.modifiers, hotkey.key, () => {
						this.close();
						return false;
					});
				}
			}
		}
	}

	// ─── Content Rendering ────────────────────────────────────────

	private renderContent(): void {
		this.contentArea.empty();

		switch (this.activeTab) {
			case "recurring":
				this.renderRecurringTab();
				break;
			case "byCategory":
				this.renderByCategoryTab();
				break;
			case "byName":
				this.renderByNameTab();
				break;
		}
	}

	// ─── Item Helpers ─────────────────────────────────────────────

	private renderSimpleList(
		items: SimpleListItem[],
		totalCount: number,
		countLabel: string,
		emptyMessage: string
	): void {
		this.contentArea.createEl("p", {
			text:
				items.length === totalCount ? `${totalCount} ${countLabel}` : `${items.length} of ${totalCount} ${countLabel}`,
			cls: cls("generic-event-list-count"),
		});

		const listContainer = this.contentArea.createDiv(cls("generic-event-list"));

		if (items.length === 0) {
			listContainer.createEl("p", {
				text: emptyMessage,
				cls: cls("generic-event-list-empty"),
			});
			return;
		}

		for (const item of items) {
			const itemEl = listContainer.createDiv(cls("generic-event-list-item"));
			itemEl.addEventListener("click", item.onClick);

			const infoEl = itemEl.createDiv(cls("generic-event-info"));
			infoEl.createEl("div", { cls: cls("generic-event-title") }).textContent = item.title;
			infoEl.createEl("div", { cls: cls("generic-event-subtitle") }).textContent =
				`${item.count} event${item.count === 1 ? "" : "s"}`;
		}
	}

	private filterAndSortSimpleItems(items: SimpleListItem[]): SimpleListItem[] {
		this.sortByTitleAndCount(items, (i) => i.count);

		if (this.searchQuery.trim()) {
			const q = this.searchQuery.toLowerCase().trim();
			return items.filter((item) => item.title.toLowerCase().includes(q));
		}
		return items;
	}

	private sortByTitleAndCount<T extends { title: string }>(items: T[], getCount: (item: T) => number): void {
		switch (this.sortMode) {
			case "count-desc":
				items.sort((a, b) => getCount(b) - getCount(a) || a.title.localeCompare(b.title));
				break;
			case "count-asc":
				items.sort((a, b) => getCount(a) - getCount(b) || a.title.localeCompare(b.title));
				break;
			case "name-asc":
				items.sort((a, b) => a.title.localeCompare(b.title));
				break;
			case "name-desc":
				items.sort((a, b) => b.title.localeCompare(a.title));
				break;
		}
	}

	// ─── By Category Tab ─────────────────────────────────────────

	private renderByCategoryTab(): void {
		const categories = this.bundle.categoryTracker.getCategories();
		const items = this.filterAndSortSimpleItems(
			categories.map((categoryName) => ({
				key: categoryName,
				title: categoryName,
				count: this.bundle.categoryTracker.getEventsWithCategory(categoryName).length,
				onClick: () => new EventSeriesModal(this.app, this.bundle, null, null, [categoryName]).open(),
			}))
		);
		this.renderSimpleList(
			items,
			categories.length,
			`category group${categories.length === 1 ? "" : "s"}`,
			"No category groups found."
		);
	}

	// ─── By Name Tab ─────────────────────────────────────────────

	private renderByNameTab(): void {
		const nameSeries = this.bundle.nameSeriesTracker.getNameBasedSeries();
		const items = this.filterAndSortSimpleItems(
			Array.from(nameSeries.entries()).map(([nameKey, files]) => ({
				key: nameKey,
				title: nameKey.charAt(0).toUpperCase() + nameKey.slice(1),
				count: files.size,
				onClick: () => new EventSeriesModal(this.app, this.bundle, nameKey, null).open(),
			}))
		);
		this.renderSimpleList(
			items,
			nameSeries.size,
			`name group${nameSeries.size === 1 ? "" : "s"}`,
			"No name groups found."
		);
	}

	// ─── Recurring Tab ───────────────────────────────────────────

	private renderRecurringTab(): void {
		const filtersContainer = this.contentArea.createDiv(cls("recurring-events-modal-filters"));

		// Type filter dropdown
		const typeFilterContainer = filtersContainer.createDiv(cls("recurring-events-type-filter"));
		typeFilterContainer.createEl("label", {
			text: "Type:",
			cls: cls("recurring-events-filter-label"),
		});
		const typeFilterSelect = typeFilterContainer.createEl("select", {
			cls: cls("recurring-events-type-select"),
		});

		for (const [value, label] of Object.entries(RECURRENCE_TYPE_FILTER_OPTIONS)) {
			const option = typeFilterSelect.createEl("option", {
				text: label,
				value,
			});
			option.value = value;
		}
		typeFilterSelect.value = this.selectedTypeFilter;

		typeFilterSelect.addEventListener("change", (e) => {
			this.selectedTypeFilter = (e.target as HTMLSelectElement).value as keyof typeof RECURRENCE_TYPE_FILTER_OPTIONS;
			this.renderContent();
		});

		// Show disabled only toggle
		if (this.disabledEvents.length > 0) {
			const toggleContainer = filtersContainer.createDiv(cls("recurring-events-toggle"));
			const label = toggleContainer.createEl("label", {
				cls: cls("recurring-events-checkbox-label"),
			});
			const checkbox = label.createEl("input", { type: "checkbox" });
			checkbox.checked = this.showDisabledOnly;
			label.createEl("span", { text: "Show disabled only" });

			checkbox.addEventListener("change", (e) => {
				this.showDisabledOnly = (e.target as HTMLInputElement).checked;
				this.renderContent();
			});
		}

		const items = this.getRecurringItems();
		this.renderRecurringList(items);
	}

	private getRecurringItems(): RecurringListItem[] {
		let events = this.showDisabledOnly ? this.disabledEvents : this.enabledEvents;

		if (this.selectedTypeFilter === "custom") {
			events = events.filter((event) => !isPresetType(event.rrules.type));
		} else if (this.selectedTypeFilter !== "all") {
			events = events.filter((event) => event.rrules.type === this.selectedTypeFilter);
		}

		const settings = this.bundle.settingsStore.currentSettings;

		let items = events.map((event) => {
			const displayTitle = removeZettelId(event.title);
			const categories = getCategoriesFromFilePath(this.app, event.sourceFilePath, settings.categoryProp);
			const instanceCount = this.bundle.recurringEventManager.getInstanceCountByRRuleId(event.rRuleId);

			return {
				filePath: event.sourceFilePath,
				title: displayTitle,
				recurrenceType: event.rrules.type,
				categories,
				instanceCount,
				rruleId: event.rRuleId,
			};
		});

		this.sortByTitleAndCount(items, (i) => i.instanceCount);

		if (this.searchQuery.trim()) {
			const q = this.searchQuery.toLowerCase().trim();
			items = items.filter((item) => item.title.toLowerCase().includes(q));
		}

		return items;
	}

	private renderRecurringList(items: RecurringListItem[]): void {
		const totalCount = (this.showDisabledOnly ? this.disabledEvents : this.enabledEvents).length;
		this.contentArea.createEl("p", {
			text:
				items.length === totalCount
					? `${totalCount} event${totalCount === 1 ? "" : "s"}`
					: `${items.length} of ${totalCount} event${totalCount === 1 ? "" : "s"}`,
			cls: cls("generic-event-list-count"),
		});

		const listContainer = this.contentArea.createDiv(cls("generic-event-list"));

		if (items.length === 0) {
			listContainer.createEl("p", {
				text: this.showDisabledOnly ? "No disabled recurring events." : "No recurring events found.",
				cls: cls("generic-event-list-empty"),
			});
			return;
		}

		for (const item of items) {
			this.createRecurringItem(listContainer, item);
		}
	}

	private createRecurringItem(container: HTMLElement, item: RecurringListItem): void {
		const itemEl = container.createEl("div", {
			cls: cls("generic-event-list-item"),
		});

		const categoryColor = this.getEventCategoryColor(item.categories);
		if (categoryColor) {
			addCls(itemEl, "recurring-event-categorized");
			itemEl.style.setProperty("--category-color", categoryColor);
		}

		itemEl.addEventListener("click", (e) => {
			if (e.target instanceof HTMLButtonElement) return;
			e.preventDefault();
			e.stopPropagation();

			if (e.ctrlKey || e.metaKey) {
				void openFileInNewTab(this.app, item.filePath);
			} else {
				this.openRecurringEventSeries(item);
			}
		});

		const infoEl = itemEl.createEl("div", { cls: cls("generic-event-info") });

		const titleRow = infoEl.createDiv(cls("recurring-event-title-row"));
		titleRow.createEl("div", { cls: cls("generic-event-title") }).textContent = item.title;

		const badgeClassSuffix = isPresetType(item.recurrenceType) ? item.recurrenceType : "custom";
		const typeBadge = titleRow.createEl("span", {
			cls: `${cls("recurring-type-badge")} ${cls(`recurring-type-${badgeClassSuffix}`)}`,
			text: formatRecurrenceLabel(item.recurrenceType),
		});
		addCls(typeBadge, `prisma-recurring-type-${badgeClassSuffix}`);

		infoEl.createEl("div", { cls: cls("generic-event-subtitle") }).textContent =
			`${item.instanceCount} instance${item.instanceCount === 1 ? "" : "s"}`;

		const actionsEl = itemEl.createEl("div", { cls: cls("generic-event-actions") });

		const catBtn = actionsEl.createEl("button", { text: "Category" });
		catBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.handleCategoryAssign(item);
		});

		const navBtn = actionsEl.createEl("button", { text: "Nav" });
		navBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.handleNavigate(item);
		});

		const primaryBtn = actionsEl.createEl("button", {
			text: this.showDisabledOnly ? "Enable" : "Disable",
		});
		primaryBtn.addClass("mod-cta");
		primaryBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.handleToggleSkip(item, itemEl);
		});
	}

	// ─── Item Actions ─────────────────────────────────────────────

	private openRecurringEventSeries(item: RecurringListItem): void {
		const events = this.showDisabledOnly ? this.disabledEvents : this.enabledEvents;
		const event = events.find((e) => e.sourceFilePath === item.filePath);
		if (!event) {
			new Notice(`Recurring event not found: ${item.title}`);
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const nameKey =
			getEventName(
				settings.titleProp,
				event.frontmatter,
				event.sourceFilePath,
				settings.calendarTitleProp
			)?.toLowerCase() ?? null;
		const categoryValues = event.metadata.categories ?? [];

		new EventSeriesModal(
			this.app,
			this.bundle,
			nameKey,
			event.rRuleId,
			categoryValues.length > 0 ? categoryValues : null
		).open();
	}

	private async handleCategoryAssign(item: RecurringListItem): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.categoryProp) {
			new Notice("Category property not configured");
			return;
		}

		const currentCategories = getCategoriesFromFilePath(this.app, item.filePath, settings.categoryProp);
		const categories = this.bundle.categoryTracker.getCategoriesWithColors();

		openCategoryAssignModal(
			this.app,
			categories,
			settings.defaultNodeColor,
			currentCategories,
			async (selectedCategories) => {
				try {
					const command = assignCategories(this.bundle, item.filePath, selectedCategories);
					await this.bundle.commandManager.executeCommand(command);
					new Notice("Categories updated");
					this.renderContent();
				} catch (error) {
					console.error("[EventsModal] Failed to assign categories:", error);
					new Notice("Failed to assign categories");
				}
			}
		);
	}

	private handleNavigate(item: RecurringListItem): void {
		const events = this.showDisabledOnly ? this.disabledEvents : this.enabledEvents;
		const event = events.find((e) => e.sourceFilePath === item.filePath);

		if (!event) {
			new Notice(`Recurring event not found: ${item.title}`);
			return;
		}

		const startDateTime = getStartDateTime(event.rrules);
		const eventDate = new Date(startDateTime.toJSDate());

		this.calendarComponent.navigateToDate(eventDate, "timeGridWeek");

		setTimeout(() => {
			this.calendarComponent.highlightEventByPath(event.sourceFilePath, 5000);
		}, 300);

		new Notice(`Navigated to source event: ${item.title}`);
		this.close();
	}

	private async handleToggleSkip(item: RecurringListItem, itemEl: HTMLElement): Promise<void> {
		try {
			const command = toggleSkip(this.bundle, item.filePath);
			await this.bundle.commandManager.executeCommand(command);

			itemEl.classList.add("prisma-fade-out");
			setTimeout(() => {
				if (this.showDisabledOnly) {
					const eventIndex = this.disabledEvents.findIndex((e) => e.sourceFilePath === item.filePath);
					if (eventIndex !== -1) {
						const [event] = this.disabledEvents.splice(eventIndex, 1);
						this.enabledEvents.push(event);
					}
					// If no more disabled events, switch back to enabled view
					if (this.disabledEvents.length === 0) {
						this.showDisabledOnly = false;
					}
				} else {
					const eventIndex = this.enabledEvents.findIndex((e) => e.sourceFilePath === item.filePath);
					if (eventIndex !== -1) {
						const [event] = this.enabledEvents.splice(eventIndex, 1);
						this.disabledEvents.push(event);
					}
					// If no more enabled events, switch to disabled view
					if (this.enabledEvents.length === 0 && this.disabledEvents.length > 0) {
						this.showDisabledOnly = true;
					}
				}

				this.updateRecurringTabCount();
				this.renderContent();
			}, 200);

			new Notice(this.showDisabledOnly ? "Recurring event enabled" : "Recurring event disabled");
		} catch (error) {
			console.error("[EventsModal] Failed to toggle recurring event:", error);
			new Notice("Failed to toggle recurring event");
		}
	}

	private updateRecurringTabCount(): void {
		const btn = this.tabButtons.get("recurring");
		if (btn) {
			const count = this.enabledEvents.length + this.disabledEvents.length;
			btn.textContent = `Recurring (${count})`;
		}
	}

	private getEventCategoryColor(categories: string[]): string | null {
		if (categories.length === 0) return null;

		const categoryInfo = this.bundle.categoryTracker.getCategoriesWithColors().find((c) => c.name === categories[0]);

		return categoryInfo?.color || null;
	}
}
