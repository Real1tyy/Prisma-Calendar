import { ColorEvaluator } from "@real1ty-obsidian-plugins";
import { showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useCallback, useEffect, useMemo, useRef } from "react";

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
	const colorEvaluatorRef = useRef<ColorEvaluator<SingleCalendarConfig> | null>(null);
	if (colorEvaluatorRef.current === null) {
		colorEvaluatorRef.current = new ColorEvaluator(bundle.settingsStore.settings$);
	}
	useEffect(() => {
		const ev = colorEvaluatorRef.current;
		return () => {
			ev?.destroy();
			colorEvaluatorRef.current = null;
		};
	}, []);

	const items: EventListItemData[] = useMemo(() => {
		const ev = colorEvaluatorRef.current;
		if (!ev) return [];
		return filteredEvents.map((event) => mapEventToItem(event, bundle, ev));
	}, [filteredEvents, bundle]);

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
