import { getDisplayData, getVirtualKind } from "../utils/extended-props";
import { isAnyVirtual } from "./calendar";
import type { Frontmatter } from "./index";
import type { SingleCalendarConfig } from "./settings";

export type EventKind = "normal" | "source" | "physical" | "virtual" | "manual" | "holiday";

interface ClassifiableEvent {
	extendedProps?: {
		filePath?: string;
		virtualKind?: string;
		frontmatterDisplayData?: Frontmatter;
	};
}

type RecurrenceSettings = Pick<SingleCalendarConfig, "rruleProp" | "rruleIdProp">;

export function getEventKind(event: ClassifiableEvent, settings: RecurrenceSettings): EventKind {
	const virtualKind = getVirtualKind(event);
	if (virtualKind === "holiday") return "holiday";
	if (virtualKind === "manual") return "manual";
	if (virtualKind === "recurring") return "virtual";

	const frontmatter = getDisplayData(event);
	if (frontmatter[settings.rruleProp]) return "source";
	if (frontmatter[settings.rruleIdProp] && !frontmatter[settings.rruleProp]) return "physical";
	return "normal";
}

export function isRecurringEventKind(kind: EventKind): boolean {
	return kind === "source" || kind === "physical" || kind === "virtual";
}

export function isHolidayEvent(event: ClassifiableEvent): boolean {
	return getVirtualKind(event) === "holiday";
}

export function isFileBackedEvent(event: ClassifiableEvent): boolean {
	return !isAnyVirtual(getVirtualKind(event));
}

export function isVirtualEvent(event: ClassifiableEvent): boolean {
	return isAnyVirtual(getVirtualKind(event));
}

export function isManualVirtualEvent(event: ClassifiableEvent): boolean {
	return getVirtualKind(event) === "manual";
}

export function isBatchSelectable(event: ClassifiableEvent): boolean {
	return isFileBackedEvent(event) || isManualVirtualEvent(event);
}
