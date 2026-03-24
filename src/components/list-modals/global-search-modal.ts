import { addCls, cls, ColorEvaluator, removeCls, toLocalISOString } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { resolveEventColor } from "../../utils/event-color";
import type { CalendarComponent } from "../calendar-view";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

type FilterState = "none" | "skip" | "only";

interface GlobalSearchFilters {
	recurring: FilterState;
	allDay: FilterState;
	skipped: FilterState;
}

const PAGE_SIZE = 50;
const SEARCH_YEAR_RANGE = 5;

function applyTriStateFilter<T>(items: T[], state: FilterState, predicate: (item: T) => boolean): T[] {
	if (state === "skip") return items.filter((item) => !predicate(item));
	if (state === "only") return items.filter(predicate);
	return items;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	year: "numeric",
	month: "short",
	day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
	hour: "2-digit",
	minute: "2-digit",
});

export class GlobalSearchModal extends BaseEventListModal {
	private allEvents: EventListItem[] = [];
	private rawEvents: CalendarEvent[] = [];
	private filters: GlobalSearchFilters = {
		recurring: "none",
		allDay: "none",
		skipped: "none",
	};
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	private renderedCount = 0;
	private loadMoreEl: HTMLElement | null = null;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private calendarComponent: CalendarComponent
	) {
		super(app);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
	}

	protected getTitle(): string {
		return "Global Event Search";
	}

	protected getEmptyMessage(): string {
		return "No events found in this calendar.";
	}

	protected getCountSuffix(): string | undefined {
		return undefined;
	}

	protected getItems(): EventListItem[] {
		return this.allEvents;
	}

	protected getActions(): EventListAction[] {
		return [
			{
				label: "Open",
				isPrimary: false,
				handler: async (item) => {
					await this.handleOpen(item);
				},
			},
			{
				label: "Navigate to",
				isPrimary: true,
				handler: (item) => {
					this.handleNavigateTo(item);
				},
			},
		];
	}

	protected getHotkeyCommandId(): string | undefined {
		return `${this.bundle.calendarId}:global-search`;
	}

	protected getSuccessMessage(): string | undefined {
		return undefined;
	}

	protected onModalClose(): void {
		this.colorEvaluator.destroy();
		this.rawEvents = [];
	}

	protected override onBeforeRender(): void {
		addCls(this.contentEl, "global-search-modal");
		this.applyFilters();
	}

	protected override renderCustomHeaderElements(contentEl: HTMLElement): void {
		this.renderFilterToggles(contentEl);
	}

	protected override filterItems(searchText: string): void {
		const normalizedSearch = searchText.toLowerCase().trim();

		if (!normalizedSearch) {
			this.filteredItems = [...this.items];
		} else {
			this.filteredItems = this.items.filter((item) => {
				const cleanTitle = item.title.toLowerCase();
				const cleanSubtitle = item.subtitle?.toLowerCase() || "";
				return cleanTitle.includes(normalizedSearch) || cleanSubtitle.includes(normalizedSearch);
			});
		}

		this.updateEventCount();
		this.renderedCount = 0;
		this.renderItems();
	}

	protected override renderItems(): void {
		if (!this.listContainer) return;

		this.listContainer.empty();
		this.renderedCount = 0;
		this.loadMoreEl?.remove();
		this.loadMoreEl = null;

		if (this.filteredItems.length === 0) {
			this.listContainer.createEl("p", {
				text: "No events match your search.",
				cls: cls("generic-event-list-empty"),
			});
			return;
		}

		this.renderNextPage();
	}

	protected override createEventItem(container: HTMLElement, item: EventListItem): void {
		if (!item.categoryColor) {
			const event = this.rawEvents.find((e) => e.ref.filePath === item.filePath);
			if (event) {
				item.categoryColor = resolveEventColor(event.meta, this.bundle, this.colorEvaluator);
			}
		}
		super.createEventItem(container, item);
	}

	private renderNextPage(): void {
		if (!this.listContainer) return;

		const end = Math.min(this.renderedCount + PAGE_SIZE, this.filteredItems.length);
		for (let i = this.renderedCount; i < end; i++) {
			this.createEventItem(this.listContainer, this.filteredItems[i]!);
		}
		this.renderedCount = end;
		this.updateLoadMoreButton();
	}

	private updateLoadMoreButton(): void {
		const remaining = this.filteredItems.length - this.renderedCount;
		if (remaining > 0) {
			if (!this.loadMoreEl) {
				this.loadMoreEl = this.listContainer!.parentElement!.createEl("button", {
					cls: cls("global-search-load-more"),
				});
				this.loadMoreEl.addEventListener("click", () => this.renderNextPage());
			}
			this.loadMoreEl.textContent = `Load more (${remaining} remaining)`;
			removeCls(this.loadMoreEl, "hidden");
		} else if (this.loadMoreEl) {
			addCls(this.loadMoreEl, "hidden");
		}
	}

	private fetchFilteredEvents(): CalendarEvent[] {
		const start = new Date();
		start.setFullYear(start.getFullYear() - SEARCH_YEAR_RANGE);
		const end = new Date();
		end.setFullYear(end.getFullYear() + SEARCH_YEAR_RANGE);

		const events = this.bundle.eventStore.getPhysicalEvents({
			start: toLocalISOString(start),
			end: toLocalISOString(end),
		});

		let filtered = events.filter((event) => !event.isVirtual);

		filtered = applyTriStateFilter(filtered, this.filters.recurring, (e) => !!e.metadata.rruleType);
		filtered = applyTriStateFilter(filtered, this.filters.allDay, (e) => e.allDay);
		filtered = applyTriStateFilter(filtered, this.filters.skipped, (e) => e.skipped);

		return filtered;
	}

	private applyFilters(): void {
		try {
			this.rawEvents = this.fetchFilteredEvents();

			this.allEvents = this.rawEvents.map((event) => ({
				filePath: event.ref.filePath,
				title: event.title,
				subtitle: formatEventSubtitle(event),
				id: event.id,
			}));
		} catch (error) {
			console.error("[GlobalSearch] Error applying filters:", error);
			this.allEvents = [];
			this.rawEvents = [];
		}
	}

	private renderFilterToggles(contentEl: HTMLElement): void {
		const filtersContainer = contentEl.createEl("div", {
			cls: cls("global-search-filters"),
		});

		const togglesContainer = filtersContainer.createEl("div", {
			cls: cls("global-search-toggles"),
		});

		this.createFilterButton(togglesContainer, "Recurring", "recurring");

		this.createFilterButton(togglesContainer, "All-day", "allDay");

		this.createFilterButton(togglesContainer, "Skipped", "skipped");
	}

	private createFilterButton(container: HTMLElement, label: string, filterKey: keyof GlobalSearchFilters): void {
		const button = container.createEl("button", {
			cls: cls("filter-cycle-button"),
		});
		button.setAttribute("data-filter-key", filterKey);

		this.updateButtonText(button, label, this.filters[filterKey]);

		button.addEventListener("click", () => {
			const currentState = this.filters[filterKey];
			let nextState: FilterState;

			if (currentState === "none") {
				nextState = "only";
			} else if (currentState === "only") {
				nextState = "skip";
			} else {
				nextState = "none";
			}

			this.filters[filterKey] = nextState;
			this.updateButtonText(button, label, nextState);

			this.applyFilters();
			this.items = this.getItems();

			const searchValue = this.searchInput?.value || "";
			this.filterItems(searchValue);
		});
	}

	private updateButtonText(button: HTMLElement, label: string, state: FilterState): void {
		button.removeClass(cls("filter-state-none"));
		button.removeClass(cls("filter-state-skip"));
		button.removeClass(cls("filter-state-only"));

		button.addClass(cls(`filter-state-${state}`));

		if (state === "none") {
			button.textContent = label;
		} else if (state === "skip") {
			button.textContent = `Skip ${label.toLowerCase()}`;
		} else {
			button.textContent = `Only ${label.toLowerCase()}`;
		}
	}

	private async handleOpen(item: EventListItem): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(item.filePath);
			if (file instanceof TFile) {
				await this.app.workspace.openLinkText(item.filePath, "", false);
				new Notice(`Opened: ${item.title}`);
			} else {
				new Notice(`File not found: ${item.filePath}`);
			}
		} catch (error) {
			console.error("[GlobalSearch] Error opening file:", error);
			new Notice(`Failed to open: ${item.filePath}`);
		}
	}

	private handleNavigateTo(item: EventListItem): void {
		try {
			const event =
				this.rawEvents.find((e) => e.ref.filePath === item.filePath) ??
				this.bundle.eventStore.getEventByPath(item.filePath);

			if (!event) {
				new Notice(`Event not found: ${item.title}`);
				return;
			}

			const eventDate = new Date(event.start);

			this.calendarComponent.navigateToDate(eventDate, "timeGridWeek");

			setTimeout(() => {
				this.calendarComponent.highlightEventByPath(item.filePath, 5000);
			}, 300);

			new Notice(`Navigated to: ${item.title}`);
			this.close();
		} catch (error) {
			console.error("[GlobalSearch] Error navigating to event:", error);
			new Notice(`Failed to navigate to: ${item.filePath}`);
		}
	}
}

function formatEventSubtitle(event: CalendarEvent): string {
	const parts: string[] = [];

	if (event.allDay) {
		parts.push("📅 All-day");
	} else {
		parts.push("⏰ Timed");
	}

	const startDate = new Date(event.start);

	if (event.allDay) {
		parts.push(dateFormatter.format(startDate));
	} else {
		const dateStr = dateFormatter.format(startDate);
		const startTimeStr = timeFormatter.format(startDate);

		if (event.end) {
			const endDate = new Date(event.end);
			const endDateStr = dateFormatter.format(endDate);
			const endTimeStr = timeFormatter.format(endDate);
			if (dateStr === endDateStr) {
				parts.push(`${dateStr} ${startTimeStr} - ${endTimeStr}`);
			} else {
				parts.push(`${dateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`);
			}
		} else {
			parts.push(`${dateStr} ${startTimeStr}`);
		}
	}

	if (event.metadata.rruleType) {
		parts.push("🔄 Recurring");
	}

	return parts.join(" • ");
}
