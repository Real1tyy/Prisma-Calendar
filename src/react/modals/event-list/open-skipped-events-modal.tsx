import { ColorEvaluator } from "@real1ty-obsidian-plugins";
import { showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { toggleSkip } from "../../../core/commands/frontmatter-update-command";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { mapEventToItem } from "../../../utils/events/event-list-mapping";
import type { EventListAction, EventListItemData } from "./event-list-item";
import { EventListModal } from "./event-list-modal";

function SkippedEventsContent({
	bundle,
	initialEvents,
	onClose,
}: {
	bundle: CalendarBundle;
	initialEvents: CalendarEvent[];
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

	const [items, setItems] = useState<EventListItemData[]>(() => {
		const ev = colorEvaluatorRef.current;
		if (!ev) return [];
		return initialEvents.map((event) => mapEventToItem(event, bundle, ev));
	});

	const openFile = useCallback(
		(item: EventListItemData) => {
			void bundle.plugin.app.workspace.openLinkText(item.filePath, "", false);
		},
		[bundle.plugin.app]
	);

	const actions: EventListAction[] = useMemo(
		() => [
			{
				label: "Un-skip",
				isPrimary: true,
				handler: async (item: EventListItemData) => {
					try {
						const command = toggleSkip(bundle, item.filePath);
						await bundle.commandManager.executeCommand(command);
						setItems((prev) => {
							const next = prev.filter((i) => i.filePath !== item.filePath);
							if (next.length === 0) {
								new Notice("All events un-skipped!");
								onClose();
							}
							return next;
						});
						new Notice("Event un-skipped");
					} catch (error) {
						console.error("[SkippedEvents] Failed to un-skip event:", error);
						new Notice("Failed to un-skip event");
					}
				},
			},
			{ label: "Open", handler: openFile },
		],
		[bundle, onClose, openFile]
	);

	return (
		<EventListModal
			items={items}
			title="Skipped Events"
			countSuffix="currently skipped"
			actions={actions}
			emptyHint="No skipped events in the current view."
			onItemClick={openFile}
			onClose={onClose}
		/>
	);
}

export function openSkippedEventsModal(app: App, bundle: CalendarBundle, skippedEvents: CalendarEvent[]): void {
	showReactModal({
		app,
		cls: "prisma-generic-event-list-modal",
		render: (close) => <SkippedEventsContent bundle={bundle} initialEvents={skippedEvents} onClose={close} />,
	});
}
