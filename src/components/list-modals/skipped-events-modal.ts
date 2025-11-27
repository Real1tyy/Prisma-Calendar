import { type App, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { ToggleSkipCommand } from "../../core/commands";
import type { ParsedEvent } from "../../core/parser";
import { formatEventTimeInfo } from "../../utils/time-formatter";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class SkippedEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private skippedEvents: ParsedEvent[]
	) {
		super(app);
	}

	protected getTitle(): string {
		return "Skipped Events";
	}

	protected getEmptyMessage(): string {
		return "No skipped events in the current view.";
	}

	protected getCountSuffix(): string | undefined {
		return "currently skipped";
	}

	protected getItems(): EventListItem[] {
		return this.skippedEvents.map((event) => ({
			id: event.id,
			filePath: event.ref.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo(event),
		}));
	}

	protected getActions(): EventListAction[] {
		return [
			{
				label: "Un-skip",
				isPrimary: true,
				handler: async (item, itemEl) => {
					try {
						const command = new ToggleSkipCommand(this.app, this.bundle, item.filePath);
						await this.bundle.commandManager.executeCommand(command);

						this.removeItem(itemEl, item);

						new Notice("Event un-skipped");
					} catch (error) {
						console.error("Failed to un-skip event:", error);
						new Notice("Failed to un-skip event");
					}
				},
			},
			{
				label: "Open",
				handler: (item) => {
					void this.app.workspace.openLinkText(item.filePath, "", false);
				},
			},
		];
	}

	protected getHotkeyCommandId(): string | undefined {
		return FULL_COMMAND_IDS.SHOW_SKIPPED_EVENTS;
	}

	protected getSuccessMessage(): string | undefined {
		return "All events un-skipped!";
	}

	protected onModalClose(): void {
		// Can be used by subclasses for cleanup
	}
}
