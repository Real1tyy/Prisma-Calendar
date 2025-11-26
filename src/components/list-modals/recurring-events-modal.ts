import { type App, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { ToggleSkipCommand } from "../../core/commands";
import type { NodeRecurringEvent } from "../../types/recurring-event";
import { getStartDateTime } from "../../utils/recurring-utils";
import type { CalendarView } from "../calendar-view";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class RecurringEventsModal extends BaseEventListModal {
	private showDisabledOnly = false;
	private enabledEvents: NodeRecurringEvent[] = [];
	private disabledEvents: NodeRecurringEvent[] = [];
	private toggleCheckbox: HTMLInputElement | null = null;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private calendarView: CalendarView
	) {
		super(app);
	}

	protected async onBeforeRender(): Promise<void> {
		this.enabledEvents = this.bundle.recurringEventManager.getEnabledRecurringEvents();
		this.disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();
	}

	protected renderCustomHeaderElements(contentEl: HTMLElement): void {
		// Only show toggle if there are disabled events
		if (this.disabledEvents.length === 0) return;

		const toggleContainer = contentEl.createEl("div", { cls: "prisma-recurring-events-toggle" });

		const label = toggleContainer.createEl("label", { cls: "prisma-checkbox-label" });
		this.toggleCheckbox = label.createEl("input", { type: "checkbox" });
		label.createEl("span", { text: "Show disabled only" });

		this.toggleCheckbox.addEventListener("change", (e) => {
			this.showDisabledOnly = (e.target as HTMLInputElement).checked;
			this.items = this.getItems();

			// Apply current search filter to new items
			const searchValue = this.searchInput?.value || "";
			this.filterItems(searchValue);
		});
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

	protected getItems(): EventListItem[] {
		const events = this.showDisabledOnly ? this.disabledEvents : this.enabledEvents;

		return events.map((event) => ({
			filePath: event.sourceFilePath,
			title: event.title,
			subtitle: event.sourceFilePath,
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
				handler: async (item) => {
					await this.handleNavigate(item);
				},
			},
		];
	}

	private async handleNavigate(item: EventListItem): Promise<void> {
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
