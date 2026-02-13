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

export class SelectedEventsModal extends BaseEventListModal {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private selected: CalendarEvent[],
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
		const settings = this.bundle.settingsStore.currentSettings;
		const categoryProp = settings.categoryProp;
		const categoriesWithColors = this.bundle.categoryTracker.getCategoriesWithColors();

		return this.selected.map((event) => ({
			id: event.id,
			filePath: event.ref.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo(event),
			categoryColor: resolveEventCategoryColor(event.meta, categoryProp, categoriesWithColors),
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
