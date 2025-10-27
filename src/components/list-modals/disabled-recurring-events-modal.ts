import { type App, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { ToggleSkipCommand } from "../../core/commands";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class DisabledRecurringEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private disabledEvents: Array<{ filePath: string; title: string }>
	) {
		super(app);
	}

	protected getTitle(): string {
		return "Disabled Recurring Events";
	}

	protected getEmptyMessage(): string {
		return "No disabled recurring events.";
	}

	protected getCountSuffix(): string | undefined {
		return undefined;
	}

	protected getItems(): EventListItem[] {
		return this.disabledEvents.map((event) => ({
			filePath: event.filePath,
			title: event.title,
			subtitle: event.filePath,
		}));
	}

	protected getActions(): EventListAction[] {
		return [
			{
				label: "Enable",
				isPrimary: true,
				handler: async (item, itemEl) => {
					try {
						const command = new ToggleSkipCommand(this.app, this.bundle, item.filePath);
						await this.bundle.commandManager.executeCommand(command);

						this.removeItem(itemEl, item);

						new Notice("Recurring event enabled");
					} catch (error) {
						console.error("Failed to enable recurring event:", error);
						new Notice("Failed to enable recurring event");
					}
				},
			},
			{
				label: "Open",
				handler: (item) => {
					this.app.workspace.openLinkText(item.filePath, "", false);
				},
			},
		];
	}

	protected getHotkeyCommandId(): string | undefined {
		return FULL_COMMAND_IDS.SHOW_DISABLED_RECURRING_EVENTS;
	}

	protected getSuccessMessage(): string | undefined {
		return undefined;
	}

	protected onModalClose(): void {
		// Can be used by subclasses for cleanup
	}
}
