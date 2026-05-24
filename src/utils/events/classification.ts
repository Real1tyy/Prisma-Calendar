import { isAnyVirtual, type EventKind, type VirtualKind } from "../../types/calendar";
import type { Frontmatter } from "../../types/index";
import type { SingleCalendarConfig } from "../../types/settings";
import { getDisplayData, getFilePath, getVirtualKind } from "../frontmatter/extended-props";

export interface ClassifiableEvent {
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

/**
 * True when a file-backed event points at a path with no file on disk — a stale
 * "phantom" left by a rename/move whose deletion event was missed. Virtual
 * events (recurring, manual, holiday) and events with no path are never orphans,
 * since they have no 1:1 file by design.
 *
 * Checked lazily on user interaction (click, context menu, drag) rather than on
 * every render — the lookup only costs anything when someone actually touches
 * the event, and the operation usually needs to resolve the file anyway.
 */
export function isOrphanedFileEvent(event: ClassifiableEvent, fileExists: (filePath: string) => boolean): boolean {
	if (!isFileBackedEvent(event)) return false;
	const filePath = getFilePath(event);
	return !!filePath && !fileExists(filePath);
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
