import { showReactModal, useColorEvaluator } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useCallback, useMemo } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { mapEventToItem } from "../../../utils/events/event-list-mapping";
import type { EventListAction, EventListItemData } from "./event-list-item";
import { EventListModal } from "./event-list-modal";

function FilteredEventsContent({
	bundle,
	filteredEvents,
	onClose,
}: {
	bundle: CalendarBundle;
	filteredEvents: CalendarEvent[];
	onClose: () => void;
}) {
	const colorEvaluator = useColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);

	const items: EventListItemData[] = useMemo(
		() => filteredEvents.map((event) => mapEventToItem(event, bundle, colorEvaluator)),
		[filteredEvents, bundle, colorEvaluator]
	);

	const openFile = useCallback(
		(item: EventListItemData) => {
			void bundle.plugin.app.workspace.openLinkText(item.filePath, "", false);
		},
		[bundle.plugin.app]
	);

	const actions: EventListAction[] = useMemo(() => [{ label: "Open", isPrimary: true, handler: openFile }], [openFile]);

	return (
		<EventListModal
			items={items}
			title="Filtered Events"
			countSuffix="filtered out"
			actions={actions}
			emptyHint="No events are currently filtered out."
			onItemClick={openFile}
			onClose={onClose}
		/>
	);
}

export function openFilteredEventsModal(app: App, bundle: CalendarBundle, filteredEvents: CalendarEvent[]): void {
	showReactModal({
		app,
		cls: "prisma-generic-event-list-modal",
		render: (close) => <FilteredEventsContent bundle={bundle} filteredEvents={filteredEvents} onClose={close} />,
	});
}
