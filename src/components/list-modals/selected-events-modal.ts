import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import {
	BaseEventListModal,
	type EventListAction,
	type EventListItem,
	mapEventToListItem,
} from "./base-event-list-modal";

export class SelectedEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private selected: CalendarEvent[],
		private onUnselectEvent: (eventId: string) => void
	) {
		super(app, bundle.settingsStore.settings$);
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
		return this.selected.map((event) => mapEventToListItem(event, this.bundle, this.colorEvaluator));
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
}
