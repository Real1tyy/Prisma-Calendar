import type { VirtualKind } from "./calendar";
import { isAnyVirtual } from "./calendar";
import type { Frontmatter } from "./index";

export type EventKind = "normal" | "source" | "physical" | "virtual" | "manual" | "holiday";

interface ClassifiableEvent {
	extendedProps?: {
		filePath?: string;
		virtualKind?: string;
		frontmatterDisplayData?: Frontmatter;
	};
}

interface RecurrenceSettings {
	rruleProp: string;
	rruleIdProp: string;
}

export function getEventKind(event: ClassifiableEvent, settings: RecurrenceSettings): EventKind {
	const virtualKind = event.extendedProps?.virtualKind;
	if (virtualKind === "holiday") return "holiday";
	if (virtualKind === "manual") return "manual";
	if (virtualKind === "recurring") return "virtual";

	const frontmatter = event.extendedProps?.frontmatterDisplayData;
	if (frontmatter?.[settings.rruleProp]) return "source";
	if (frontmatter?.[settings.rruleIdProp] && !frontmatter?.[settings.rruleProp]) return "physical";
	return "normal";
}

export function isRecurringEventKind(kind: EventKind): boolean {
	return kind === "source" || kind === "physical" || kind === "virtual";
}

export function isHolidayEvent(event: ClassifiableEvent): boolean {
	return event.extendedProps?.virtualKind === "holiday";
}

export function isFileBackedEvent(event: ClassifiableEvent): boolean {
	return !isAnyVirtual(event.extendedProps?.virtualKind as VirtualKind | undefined);
}

export function isVirtualEvent(event: ClassifiableEvent): boolean {
	return isAnyVirtual(event.extendedProps?.virtualKind as VirtualKind | undefined);
}
