import type { App } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { formatEventTimeInfo } from "../../utils/time-formatter";
import {
	BaseEventListModal,
	type EventListAction,
	type EventListItem,
	resolveEventCategoryColor,
} from "./base-event-list-modal";

export class FilteredEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private filteredEvents: CalendarEvent[]
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
		const settings = this.bundle.settingsStore.currentSettings;
		const categoryProp = settings.categoryProp;
		const categoriesWithColors = this.bundle.categoryTracker.getCategoriesWithColors();

		return this.filteredEvents.map((event) => ({
			filePath: event.ref.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo(event),
			categoryColor: resolveEventCategoryColor(event.meta, categoryProp, categoriesWithColors),
		}));
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

	protected onModalClose(): void {
		// Can be used by subclasses for cleanup
	}
}
