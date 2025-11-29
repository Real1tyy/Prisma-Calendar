import { addCls, cls } from "@real1ty-obsidian-plugins/utils";
import { type App, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { ToggleSkipCommand } from "../../core/commands";
import { type NodeRecurringEvent, RECURRENCE_TYPE_OPTIONS } from "../../types/recurring-event";
import type { RecurrenceType } from "../../utils/date-recurrence";
import { getStartDateTime } from "../../utils/recurring-utils";
import type { CalendarView } from "../calendar-view";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

interface RecurringEventListItem extends EventListItem {
	recurrenceType: RecurrenceType;
}

const RECURRENCE_TYPE_FILTER_OPTIONS = {
	all: "All Types",
	...RECURRENCE_TYPE_OPTIONS,
} as const;

export class RecurringEventsModal extends BaseEventListModal {
	private showDisabledOnly = false;
	private selectedTypeFilter: keyof typeof RECURRENCE_TYPE_FILTER_OPTIONS = "all";
	private enabledEvents: NodeRecurringEvent[] = [];
	private disabledEvents: NodeRecurringEvent[] = [];
	private toggleCheckbox: HTMLInputElement | null = null;
	private typeFilterSelect: HTMLSelectElement | null = null;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private calendarView: CalendarView
	) {
		super(app);
	}

	protected onBeforeRender(): void {
		this.enabledEvents = this.bundle.recurringEventManager.getEnabledRecurringEvents();
		this.disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();
	}

	protected renderCustomHeaderElements(contentEl: HTMLElement): void {
		const filtersContainer = contentEl.createDiv(cls("recurring-events-modal-filters"));

		// Type filter dropdown
		const typeFilterContainer = filtersContainer.createDiv(cls("recurring-events-type-filter"));
		typeFilterContainer.createEl("label", { text: "Type:", cls: cls("recurring-events-filter-label") });
		this.typeFilterSelect = typeFilterContainer.createEl("select", { cls: cls("recurring-events-type-select") });

		for (const [value, label] of Object.entries(RECURRENCE_TYPE_FILTER_OPTIONS)) {
			const option = this.typeFilterSelect.createEl("option", { text: label, value });
			option.value = value;
		}

		this.typeFilterSelect.addEventListener("change", (e) => {
			this.selectedTypeFilter = (e.target as HTMLSelectElement).value as keyof typeof RECURRENCE_TYPE_FILTER_OPTIONS;
			this.items = this.getItems();
			const searchValue = this.searchInput?.value || "";
			this.filterItems(searchValue);
		});

		// Only show toggle if there are disabled events
		if (this.disabledEvents.length > 0) {
			const toggleContainer = filtersContainer.createDiv(cls("recurring-events-toggle"));
			const label = toggleContainer.createEl("label", { cls: cls("recurring-events-checkbox-label") });
			this.toggleCheckbox = label.createEl("input", { type: "checkbox" });
			label.createEl("span", { text: "Show disabled only" });

			this.toggleCheckbox.addEventListener("change", (e) => {
				this.showDisabledOnly = (e.target as HTMLInputElement).checked;
				this.items = this.getItems();
				const searchValue = this.searchInput?.value || "";
				this.filterItems(searchValue);
			});
		}
	}

	protected getTitle(): string {
		return "Recurring Events";
	}

	protected getEmptyMessage(): string {
		if (this.showDisabledOnly) {
			return "No disabled recurring events.";
		}
		return "No recurring events found.";
	}

	protected getCountSuffix(): string | undefined {
		return undefined;
	}

	protected getItems(): RecurringEventListItem[] {
		let events = this.showDisabledOnly ? this.disabledEvents : this.enabledEvents;

		// Apply type filter
		if (this.selectedTypeFilter !== "all") {
			events = events.filter((event) => event.rrules.type === this.selectedTypeFilter);
		}

		return events.map((event) => ({
			filePath: event.sourceFilePath,
			title: event.title,
			subtitle: event.sourceFilePath,
			recurrenceType: event.rrules.type,
		}));
	}

	protected getActions(): EventListAction[] {
		const primaryAction: EventListAction = this.showDisabledOnly
			? {
					label: "Enable",
					isPrimary: true,
					handler: async (item, itemEl) => {
						try {
							const command = new ToggleSkipCommand(this.app, this.bundle, item.filePath);
							await this.bundle.commandManager.executeCommand(command);

							this.removeItem(itemEl, item);

							// Move from disabled to enabled list
							const eventIndex = this.disabledEvents.findIndex((e) => e.sourceFilePath === item.filePath);
							if (eventIndex !== -1) {
								const [event] = this.disabledEvents.splice(eventIndex, 1);
								this.enabledEvents.push(event);
							}

							new Notice("Recurring event enabled");
						} catch (error) {
							console.error("Failed to enable recurring event:", error);
							new Notice("Failed to enable recurring event");
						}
					},
				}
			: {
					label: "Disable",
					isPrimary: true,
					handler: async (item, itemEl) => {
						try {
							const command = new ToggleSkipCommand(this.app, this.bundle, item.filePath);
							await this.bundle.commandManager.executeCommand(command);

							this.removeItem(itemEl, item);

							// Move from enabled to disabled list
							const eventIndex = this.enabledEvents.findIndex((e) => e.sourceFilePath === item.filePath);
							if (eventIndex !== -1) {
								const [event] = this.enabledEvents.splice(eventIndex, 1);
								this.disabledEvents.push(event);
							}

							new Notice("Recurring event disabled");
						} catch (error) {
							console.error("Failed to disable recurring event:", error);
							new Notice("Failed to disable recurring event");
						}
					},
				};

		return [
			primaryAction,
			{
				label: "Navigate",
				handler: (item) => {
					this.handleNavigate(item);
				},
			},
		];
	}

	private handleNavigate(item: EventListItem): void {
		try {
			// Find the recurring event
			const events = this.showDisabledOnly ? this.disabledEvents : this.enabledEvents;
			const event = events.find((e) => e.sourceFilePath === item.filePath);

			if (!event) {
				new Notice(`Recurring event not found: ${item.title}`);
				return;
			}

			// Get the start date from the source event
			const startDateTime = getStartDateTime(event.rrules);
			const eventDate = new Date(startDateTime.toJSDate());

			// Navigate to the week view at the source event date
			this.calendarView.navigateToDate(eventDate, "timeGridWeek");

			// Highlight the source event after a short delay
			setTimeout(() => {
				this.calendarView.highlightEventByPath(event.sourceFilePath, 5000);
			}, 300);

			new Notice(`Navigated to source event: ${item.title}`);
			this.close();
		} catch (error) {
			console.error("Error navigating to recurring event:", error);
			new Notice(`Failed to navigate to: ${item.filePath}`);
		}
	}

	protected override createEventItem(container: HTMLElement, item: EventListItem): void {
		const recurringItem = item as RecurringEventListItem;
		const itemEl = container.createEl("div", { cls: cls("generic-event-list-item") });

		// Event info section
		const infoEl = itemEl.createEl("div", { cls: cls("generic-event-info") });

		// Title row with type badge
		const titleRow = infoEl.createDiv(cls("recurring-event-title-row"));
		const titleEl = titleRow.createEl("div", { cls: cls("generic-event-title") });
		titleEl.textContent = item.title.replace(/^\d{14}-/, ""); // Remove zettelid prefix

		// Type badge (always visible, not just when filter is "all")
		const typeBadge = titleRow.createEl("span", {
			cls: `${cls("recurring-type-badge")} ${cls(`recurring-type-${recurringItem.recurrenceType}`)}`,
			text: RECURRENCE_TYPE_OPTIONS[recurringItem.recurrenceType],
		});
		addCls(typeBadge, `prisma-recurring-type-${recurringItem.recurrenceType}`);

		// Subtitle
		if (item.subtitle) {
			const subtitleEl = infoEl.createEl("div", { cls: cls("generic-event-subtitle") });
			subtitleEl.textContent = item.subtitle;
		}

		// Action buttons
		const actions = this.getActions();
		if (actions.length > 0) {
			const actionsEl = itemEl.createEl("div", { cls: cls("generic-event-actions") });
			for (const action of actions) {
				const btn = actionsEl.createEl("button", { text: action.label });
				if (action.isPrimary) {
					btn.addClass("mod-cta");
				}
				btn.addEventListener("click", (e) => {
					e.stopPropagation();
					void action.handler(item, itemEl);
				});
			}
		}
	}

	protected getHotkeyCommandId(): string | undefined {
		return FULL_COMMAND_IDS.SHOW_RECURRING_EVENTS;
	}

	protected getSuccessMessage(): string | undefined {
		return undefined;
	}

	protected onModalClose(): void {
		// Can be used by subclasses for cleanup
	}
}
