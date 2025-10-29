import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
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
				handler: async (item) => {
					await this.handleNavigateTo(item);
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

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.onModalClose();
	}

	protected onModalClose(): void {
		// No special cleanup needed
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("global-search-modal");
		contentEl.addClass("generic-event-list-modal");

		// Load all events from the store
		await this.loadAllEvents();

		// Apply initial filters
		await this.applyFilters();

		// Initialize items
		this.items = this.getItems();
		this.filteredItems = [...this.items];

		this.registerHotkeys();

		// Title
		contentEl.createEl("h2", { text: this.getTitle() });

		// Render filter toggles AFTER title
		this.renderFilterToggles(contentEl);

		if (this.items.length === 0) {
			contentEl.createEl("p", { text: this.getEmptyMessage() });
			return;
		}

		// Search input
		const searchContainer = contentEl.createEl("div", { cls: "generic-event-list-search" });
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search events... (Ctrl/Cmd+F)",
			cls: "generic-event-search-input",
		});

		this.searchInput.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			this.filterItems(target.value);
		});

		// Auto-focus the search input when modal opens
		setTimeout(() => {
			this.searchInput?.focus();
		}, 50);

		// Count
		const countSuffix = this.getCountSuffix();
		const countText = countSuffix
			? `${this.items.length} event${this.items.length === 1 ? "" : "s"} ${countSuffix}`
			: `${this.items.length} event${this.items.length === 1 ? "" : "s"}`;
		contentEl.createEl("p", {
			text: countText,
			cls: "generic-event-list-count",
		});

		// Event list
		this.listContainer = contentEl.createEl("div", { cls: "generic-event-list" });

		this.renderItems();
	}

	protected filterItems(searchText: string): void {
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

		this.renderItems();
	}

	protected renderItems(): void {
		if (!this.listContainer) return;

		this.listContainer.empty();

		if (this.filteredItems.length === 0) {
			this.listContainer.createEl("p", {
				text: "No events match your search.",
				cls: "generic-event-list-empty",
			});
			return;
		}

		for (const item of this.filteredItems) {
			this.createEventItem(this.listContainer, item);
		}
	}

	protected createEventItem(container: HTMLElement, item: EventListItem): void {
		const itemEl = container.createEl("div", { cls: "generic-event-list-item" });

		// Event info
		const infoEl = itemEl.createEl("div", { cls: "generic-event-info" });

		// Title
		const titleEl = infoEl.createEl("div", { cls: "generic-event-title" });
		titleEl.textContent = item.title;

		// Subtitle (time/path info)
		if (item.subtitle) {
			const subtitleEl = infoEl.createEl("div", { cls: "generic-event-subtitle" });
			subtitleEl.textContent = item.subtitle;
		}

		// Action buttons
		const actions = this.getActions();
		if (actions.length > 0) {
			const actionsEl = itemEl.createEl("div", { cls: "generic-event-actions" });

			for (const action of actions) {
				const btn = actionsEl.createEl("button", { text: action.label });
				if (action.isPrimary) {
					btn.addClass("mod-cta");
				}
				btn.addEventListener("click", async (e) => {
					e.stopPropagation();
					await action.handler(item, itemEl);
				});
			}
		}
	}

	protected registerHotkeys(): void {
		// Register Ctrl/Cmd+F to focus search
		this.scope.register(["Mod"], "f", (evt) => {
			evt.preventDefault();
			this.searchInput?.focus();
			this.searchInput?.select();
			return false;
		});

		// Register Escape to close modal or clear search
		this.scope.register([], "Escape", () => {
			// If search is focused and has content, clear it first
			if (this.searchInput && document.activeElement === this.searchInput) {
				if (this.searchInput.value) {
					this.searchInput.value = "";
					this.filterItems("");
					return false;
				}
				// If search is empty, unfocus it
				this.searchInput.blur();
				return false;
			}
			// Otherwise close the modal
			this.close();
			return false;
		});

		// Listen for command hotkey to toggle close
		const hotkeyCommandId = this.getHotkeyCommandId();
		if (hotkeyCommandId) {
			const hotkeys = (this.app as any).hotkeyManager?.getHotkeys(hotkeyCommandId);
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

	private async loadAllEvents(): Promise<void> {
		try {
			// Get a wide date range to capture all events
			const start = new Date();
			start.setFullYear(start.getFullYear() - 5);
			const end = new Date();
			end.setFullYear(end.getFullYear() + 5);

			// Events are already filtered by global filter rules in the parser
			const events = await this.bundle.eventStore.getPhysicalEvents({
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

	private formatEventSubtitle(event: any): string {
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
		const filtersContainer = contentEl.createEl("div", { cls: "global-search-filters" });

		const togglesContainer = filtersContainer.createEl("div", { cls: "global-search-toggles" });

		this.createFilterButton(togglesContainer, "Recurring", "recurring");

		this.createFilterButton(togglesContainer, "All-day", "allDay");

		this.createFilterButton(togglesContainer, "Skipped", "skipped");
	}

	private createFilterButton(container: HTMLElement, label: string, filterKey: keyof GlobalSearchFilters): void {
		const button = container.createEl("button", { cls: "filter-cycle-button" });
		button.setAttribute("data-filter-key", filterKey);

		this.updateButtonText(button, label, this.filters[filterKey]);

		button.addEventListener("click", async () => {
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

			await this.applyFilters();
			this.items = this.getItems();
			this.filteredItems = [...this.items];
			this.updateEventCount();
			this.renderItems();
		});
	}

	private updateButtonText(button: HTMLElement, label: string, state: FilterState): void {
		button.removeClass("filter-state-none");
		button.removeClass("filter-state-skip");
		button.removeClass("filter-state-only");

		// Add current state class
		button.addClass(`filter-state-${state}`);

		// Update button text
		if (state === "none") {
			button.textContent = label;
		} else if (state === "skip") {
			button.textContent = `Skip ${label.toLowerCase()}`;
		} else {
			button.textContent = `Only ${label.toLowerCase()}`;
		}
	}

	private updateEventCount(): void {
		const countEl = this.contentEl.querySelector(".generic-event-list-count");
		if (countEl) {
			const countSuffix = this.getCountSuffix();
			const countText = countSuffix
				? `${this.items.length} event${this.items.length === 1 ? "" : "s"} ${countSuffix}`
				: `${this.items.length} event${this.items.length === 1 ? "" : "s"}`;
			countEl.textContent = countText;
		}
	}

	private async applyFilters(): Promise<void> {
		try {
			// Get fresh event data for filtering
			const start = new Date();
			start.setFullYear(start.getFullYear() - 5);
			const end = new Date();
			end.setFullYear(end.getFullYear() + 5);

			// Use getPhysicalEvents for better performance (skips virtual event generation)
			// Events are already filtered by global filter rules in the parser
			const events = await this.bundle.eventStore.getPhysicalEvents({
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

	private async handleNavigateTo(item: EventListItem): Promise<void> {
		try {
			// Find the event in the store to get its date
			const start = new Date();
			start.setFullYear(start.getFullYear() - 5);
			const end = new Date();
			end.setFullYear(end.getFullYear() + 5);

			// Use getPhysicalEvents for better performance
			const events = await this.bundle.eventStore.getPhysicalEvents({
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
