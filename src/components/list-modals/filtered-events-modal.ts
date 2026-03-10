import { ColorEvaluator } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { resolveEventColor } from "../../utils/event-color";
import { formatEventTimeInfo } from "../../utils/time-formatter";
import { BaseEventListModal, type EventListAction, type EventListItem } from "./base-event-list-modal";

export class FilteredEventsModal extends BaseEventListModal {
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private filteredEvents: CalendarEvent[]
	) {
		super(app);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
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
			filePath: event.ref.filePath,
			title: event.title,
			subtitle: formatEventTimeInfo(event),
			categoryColor: resolveEventColor(event.meta, this.bundle, this.colorEvaluator),
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
		this.colorEvaluator.destroy();
	}
}
