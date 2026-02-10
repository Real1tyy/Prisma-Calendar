import type { PrismaEventInput } from "../types/calendar";

export interface EventDiff {
	added: PrismaEventInput[];
	removed: string[];
	changed: PrismaEventInput[];
}

/**
 * Creates a stable fingerprint string from all rendering-relevant fields of an event.
 * Used to detect whether a FullCalendar event needs DOM updates.
 */
export function eventFingerprint(ev: PrismaEventInput): string {
	return [
		ev.title ?? "",
		ev.start ?? "",
		ev.end ?? "",
		ev.allDay ? "1" : "0",
		ev.backgroundColor ?? "",
		ev.borderColor ?? "",
		ev.className ?? "",
		JSON.stringify(ev.extendedProps.frontmatterDisplayData),
		ev.extendedProps.filePath,
		ev.extendedProps.folder,
		ev.extendedProps.originalTitle,
		ev.extendedProps.isVirtual ? "1" : "0",
	].join("\0");
}

/**
 * Compares previously rendered events against the new event list.
 * Returns which events were added, removed, or changed (need in-place property updates).
 */
export function diffEvents(previous: Map<string, string>, next: PrismaEventInput[]): EventDiff {
	const added: PrismaEventInput[] = [];
	const changed: PrismaEventInput[] = [];
	const seen = new Set<string>();

	for (const ev of next) {
		const id = ev.id as string;
		seen.add(id);

		const prevFingerprint = previous.get(id);
		if (prevFingerprint === undefined) {
			added.push(ev);
		} else if (eventFingerprint(ev) !== prevFingerprint) {
			changed.push(ev);
		}
	}

	const removed: string[] = [];
	for (const id of previous.keys()) {
		if (!seen.has(id)) {
			removed.push(id);
		}
	}

	return { added, removed, changed };
}
