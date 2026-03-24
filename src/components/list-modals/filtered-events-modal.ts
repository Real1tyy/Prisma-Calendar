import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import {
	BaseEventListModal,
	type EventListAction,
	type EventListItem,
	mapEventToListItem,
} from "./base-event-list-modal";

export class FilteredEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private filteredEvents: CalendarEvent[]
	) {
		super(app, bundle.settingsStore.settings$);
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
		return this.filteredEvents.map((event) => mapEventToListItem(event, this.bundle, this.colorEvaluator));
	}

	protected getActions(): EventListAction[] {
		return [
			{
				label: "Open",
				isPrimary: true,
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
		return undefined;
	}
}
