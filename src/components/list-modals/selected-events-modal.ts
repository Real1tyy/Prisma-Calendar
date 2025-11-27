import type { App } from "obsidian";
import { formatEventTimeInfo } from "../../utils/time-formatter";
import type { SelectedEvent } from "../batch-selection-manager";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class SelectedEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private selected: SelectedEvent[],
		private onUnselectEvent: (eventId: string) => void
	) {
		super(app);
	}

	protected getTitle(): string {
		return "Selected Events";
	}

	protected getEmptyMessage(): string {
		return "No events are currently selected.";
	}

	protected getCountSuffix(): string | undefined {
		return "selected";
	}

	protected getItems(): EventListItem[] {
		return this.selected.map((event) => ({
			id: event.id,
			filePath: event.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo({
				start: event.start,
				end: event.end,
				allDay: event.allDay,
			}),
		}));
	}

	protected getActions(): EventListAction[] {
		return [
			{
				label: "Unselect",
				isPrimary: true,
				handler: (item, itemEl) => {
					if (item.id) {
						this.onUnselectEvent(item.id);
						this.removeItem(itemEl, item);
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
		return undefined;
	}

	protected getSuccessMessage(): string | undefined {
		return "All events unselected!";
	}

	protected onModalClose(): void {
		// Cleanup handled by parent
	}
}
