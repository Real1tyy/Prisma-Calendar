import type { App } from "obsidian";
import { formatEventTimeInfo } from "../../utils/time-formatter";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class FilteredEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private filteredEvents: Array<{ filePath: string; title: string; start: string; end?: string; allDay: boolean }>
	) {
		super(app);
	}

	protected getTitle(): string {
		return "Filtered Events";
	}

	protected getEmptyMessage(): string {
		return "No events are currently filtered out.";
	}

	protected getCountSuffix(): string | undefined {
		return "filtered out";
	}

	protected getItems(): EventListItem[] {
		return this.filteredEvents.map((event) => ({
			filePath: event.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo(event),
		}));
	}

	protected getActions(): EventListAction[] {
		return [
			{
				label: "Open",
				isPrimary: true,
				handler: (item) => {
					this.app.workspace.openLinkText(item.filePath, "", false);
				},
			},
		];
	}

	protected getHotkeyCommandId(): string | undefined {
		return undefined;
	}

	protected getSuccessMessage(): string | undefined {
		return undefined;
	}

	protected onModalClose(): void {
		// Can be used by subclasses for cleanup
	}
}
