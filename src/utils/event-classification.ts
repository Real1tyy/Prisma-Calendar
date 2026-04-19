import type { EventKind, VirtualKind } from "../types/calendar";
import { isAnyVirtual } from "../types/calendar";
import type { Frontmatter } from "../types/index";
import type { SingleCalendarConfig } from "../types/settings";
import { getDisplayData, getVirtualKind } from "./extended-props";

interface ClassifiableEvent {
	extendedProps?: {
		filePath?: string | undefined;
		virtualKind?: string | undefined;
		frontmatterDisplayData?: Frontmatter | undefined;
	};
}

export function getEventKind(
	event: ClassifiableEvent,
	settings: Pick<SingleCalendarConfig, "rruleProp" | "rruleIdProp">
): EventKind {
	const virtualKind: VirtualKind = getVirtualKind(event);
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
