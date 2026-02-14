import { ColorEvaluator } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { formatEventTimeInfo } from "../../utils/time-formatter";
import { resolveEventColor } from "../../utils/event-color";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class SelectedEventsModal extends BaseEventListModal {
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private selected: CalendarEvent[],
		private onUnselectEvent: (eventId: string) => void
	) {
		super(app);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
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
			filePath: event.ref.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo(event),
			categoryColor: resolveEventColor(event.meta, this.bundle, this.colorEvaluator),
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
		this.colorEvaluator.destroy();
	}
}
