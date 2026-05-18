import { showReactModal, useColorEvaluator } from "@real1ty-obsidian-plugins-react";
import { Notice, type App } from "obsidian";
import { useCallback, useMemo, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { mapEventToItem } from "../../../utils/events/list-mapping";
import type { EventListAction, EventListItemData } from "./event-list-item";
import { EventListModal } from "./event-list-modal";

function SelectedEventsContent({
	bundle,
	initialEvents,
	onUnselectEvent,
	onClose,
}: {
	bundle: CalendarBundle;
	initialEvents: CalendarEvent[];
	onUnselectEvent: (eventId: string) => void;
	onClose: () => void;
}) {
	const colorEvaluator = useColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);

	const [items, setItems] = useState<EventListItemData[]>(() =>
		initialEvents.map((event) => mapEventToItem(event, bundle, colorEvaluator))
	);

	const openFile = useCallback(
		(item: EventListItemData) => {
			void bundle.plugin.app.workspace.openLinkText(item.filePath, "", false);
		},
		[bundle.plugin.app]
	);

	const actions: EventListAction[] = useMemo(
		() => [
			{
				label: "Unselect",
				isPrimary: true,
				handler: (item: EventListItemData) => {
					if (!item.id) return;
					onUnselectEvent(item.id);
					setItems((prev) => {
						const next = prev.filter((i) => i.id !== item.id);
						if (next.length === 0) {
							new Notice("All events unselected!");
							onClose();
						}
						return next;
					});
				},
			},
			{ label: "Open", handler: openFile },
		],
		[onUnselectEvent, onClose, openFile]
	);

	return (
		<EventListModal
			items={items}
			title="Selected Events"
			countSuffix="selected"
			actions={actions}
			emptyHint="No events are currently selected."
			onItemClick={openFile}
			onClose={onClose}
		/>
	);
}

export function openSelectedEventsModal(
	app: App,
	bundle: CalendarBundle,
	selectedEvents: CalendarEvent[],
	onUnselectEvent: (eventId: string) => void
): void {
	showReactModal({
		app,
		cls: "prisma-generic-event-list-modal",
		render: (close) => (
			<SelectedEventsContent
				bundle={bundle}
				initialEvents={selectedEvents}
				onUnselectEvent={onUnselectEvent}
				onClose={close}
			/>
		),
	});
}
