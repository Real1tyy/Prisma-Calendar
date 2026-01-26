import { addCls, cls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { Frontmatter } from "../../types";
import type { CalendarView } from "../calendar-view";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

type FilterState = "none" | "skip" | "only";

interface GlobalSearchFilters {
	recurring: FilterState;
	allDay: FilterState;
	skipped: FilterState;
}

export class GlobalSearchModal extends BaseEventListModal {
	private allEvents: EventListItem[] = [];
	private filters: GlobalSearchFilters = {
		recurring: "none",
		allDay: "none",
		skipped: "none",
	};

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private calendarView: CalendarView
	) {
		super(app);
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
		// No special cleanup needed
	}

	protected onBeforeRender(): void {
		// Add custom CSS class for this modal
		addCls(this.contentEl, "global-search-modal");

		// Load all events from the store
		this.loadAllEvents();

		// Apply initial filters
		this.applyFilters();
	}

	protected renderCustomHeaderElements(contentEl: HTMLElement): void {
		// Render filter toggles after title
		this.renderFilterToggles(contentEl);
	}

	protected filterItems(searchText: string): void {
		const normalizedSearch = searchText.toLowerCase().trim();

		if (!normalizedSearch) {
			this.filteredItems = [...this.items];
		} else {
			// Override to search both title and subtitle
			this.filteredItems = this.items.filter((item) => {
				const cleanTitle = item.title.toLowerCase();
				const cleanSubtitle = item.subtitle?.toLowerCase() || "";
				return cleanTitle.includes(normalizedSearch) || cleanSubtitle.includes(normalizedSearch);
			});
		}

		this.updateEventCount();
		this.renderItems();
	}

	private loadAllEvents(): void {
		try {
			// Get a wide date range to capture all events
			const start = new Date();
			start.setFullYear(start.getFullYear() - 5);
			const end = new Date();
			end.setFullYear(end.getFullYear() + 5);

			// Events are already filtered by global filter rules in the parser
			const events = this.bundle.eventStore.getPhysicalEvents({
				start: start.toISOString(),
				end: end.toISOString(),
			});

			const filteredEvents = events.filter((event) => !event.isVirtual);

			this.allEvents = filteredEvents.map((event) => ({
				filePath: event.ref.filePath,
				title: event.title,
				subtitle: this.formatEventSubtitle(event),
				id: event.id,
			}));
		} catch (error) {
			console.error("Error loading events for global search:", error);
			this.allEvents = [];
		}
	}

	private formatEventSubtitle(event: { allDay: boolean; start: string; end?: string; meta?: Frontmatter }): string {
		const parts: string[] = [];
		const settings = this.bundle.settingsStore.currentSettings;

		// Event type indicator
		if (event.allDay) {
			parts.push("📅 All-day");
		} else {
			parts.push("⏰ Timed");
		}

		// Format date/time info
		const startDate = new Date(event.start);
		const dateOptions: Intl.DateTimeFormatOptions = {
			year: "numeric",
			month: "short",
			day: "numeric",
		};
		const timeOptions: Intl.DateTimeFormatOptions = {
			hour: "2-digit",
			minute: "2-digit",
		};

		if (event.allDay) {
			// All-day event: just show the date
			const dateStr = startDate.toLocaleDateString(undefined, dateOptions);
			parts.push(dateStr);
		} else {
			// Timed event: show date and time range
			const dateStr = startDate.toLocaleDateString(undefined, dateOptions);
			const startTimeStr = startDate.toLocaleTimeString(undefined, timeOptions);

			if (event.end) {
				const endDate = new Date(event.end);
				const endTimeStr = endDate.toLocaleTimeString(undefined, timeOptions);
				// Check if same day
				if (dateStr === endDate.toLocaleDateString(undefined, dateOptions)) {
					parts.push(`${dateStr} ${startTimeStr} - ${endTimeStr}`);
				} else {
					const endDateStr = endDate.toLocaleDateString(undefined, dateOptions);
					parts.push(`${dateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`);
				}
			} else {
				parts.push(`${dateStr} ${startTimeStr}`);
			}
		}

		// Add recurring indicator
		const rrule = event.meta?.[settings.rruleProp];
		if (rrule) {
			parts.push("🔄 Recurring");
		}

		return parts.join(" • ");
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
			// Cycle through states: none → only → skip → none
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

		// Add current state class
		button.addClass(cls(`filter-state-${state}`));

		// Update button text
		if (state === "none") {
			button.textContent = label;
		} else if (state === "skip") {
			button.textContent = `Skip ${label.toLowerCase()}`;
		} else {
			button.textContent = `Only ${label.toLowerCase()}`;
		}
	}

	private applyFilters(): void {
		try {
			// Get fresh event data for filtering
			const start = new Date();
			start.setFullYear(start.getFullYear() - 5);
			const end = new Date();
			end.setFullYear(end.getFullYear() + 5);

			// Use getPhysicalEvents for better performance (skips virtual event generation)
			// Events are already filtered by global filter rules in the parser
			const events = this.bundle.eventStore.getPhysicalEvents({
				start: start.toISOString(),
				end: end.toISOString(),
			});

			let filteredEvents = events.filter((event) => !event.isVirtual);

			const settings = this.bundle.settingsStore.currentSettings;
			if (this.filters.recurring === "skip") {
				filteredEvents = filteredEvents.filter((event) => {
					const rrule = event.meta?.[settings.rruleProp];
					return !rrule;
				});
			} else if (this.filters.recurring === "only") {
				filteredEvents = filteredEvents.filter((event) => {
					const rrule = event.meta?.[settings.rruleProp];
					return !!rrule;
				});
			}

			if (this.filters.allDay === "skip") {
				filteredEvents = filteredEvents.filter((event) => !event.allDay);
			} else if (this.filters.allDay === "only") {
				filteredEvents = filteredEvents.filter((event) => event.allDay);
			}

			if (this.filters.skipped === "skip") {
				filteredEvents = filteredEvents.filter((event) => !event.skipped);
			} else if (this.filters.skipped === "only") {
				filteredEvents = filteredEvents.filter((event) => event.skipped);
			}

			this.allEvents = filteredEvents.map((event) => ({
				filePath: event.ref.filePath,
				title: event.title,
				subtitle: this.formatEventSubtitle(event),
				id: event.id,
			}));
		} catch (error) {
			console.error("Error applying filters:", error);
			this.allEvents = [];
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
			console.error("Error opening file:", error);
			new Notice(`Failed to open: ${item.filePath}`);
		}
	}

	private handleNavigateTo(item: EventListItem): void {
		try {
			// Find the event in the store to get its date
			const start = new Date();
			start.setFullYear(start.getFullYear() - 5);
			const end = new Date();
			end.setFullYear(end.getFullYear() + 5);

			// Use getPhysicalEvents for better performance
			const events = this.bundle.eventStore.getPhysicalEvents({
				start: start.toISOString(),
				end: end.toISOString(),
			});

			const event = events.find((e) => e.ref.filePath === item.filePath);
			if (!event) {
				new Notice(`Event not found: ${item.title}`);
				return;
			}

			// Parse the event start date
			const eventDate = new Date(event.start);

			// Navigate to the week view at that date
			this.calendarView.navigateToDate(eventDate, "timeGridWeek");

			// Highlight the event
			setTimeout(() => {
				this.calendarView.highlightEventByPath(item.filePath, 5000);
			}, 300);

			new Notice(`Navigated to: ${item.title}`);
			this.close();
		} catch (error) {
			console.error("Error navigating to event:", error);
			new Notice(`Failed to navigate to: ${item.filePath}`);
		}
	}
}
