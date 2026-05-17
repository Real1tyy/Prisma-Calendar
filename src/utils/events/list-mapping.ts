import type { ColorEvaluator } from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { formatEventTimeInfo } from "../format";
import { resolveEventColor } from "./color";
import { removeZettelId } from "./zettel-id";

export interface EventListItemData {
	id?: string;
	filePath: string;
	title: string;
	subtitle?: string;
	categoryColor?: string;
}

export function mapEventToItem(
	event: CalendarEvent,
	bundle: CalendarBundle,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): EventListItemData {
	return {
		id: event.id,
		filePath: event.ref.filePath,
		title: removeZettelId(event.title),
		subtitle: formatEventTimeInfo(event),
		categoryColor: resolveEventColor(event.meta, bundle, colorEvaluator),
	};
}
