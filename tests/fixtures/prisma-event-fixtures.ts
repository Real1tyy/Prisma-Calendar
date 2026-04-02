import type { PrismaEventInput } from "../../src/types/calendar";
import { eventFingerprint } from "../../src/utils/event-diff";

/** Factory for PrismaEventInput (FullCalendar EventInput format). */
export function createPrismaEventInput(overrides: Partial<PrismaEventInput> & { id: string }): PrismaEventInput {
	return {
		title: "Event",
		start: "2024-03-15T09:00:00",
		end: "2024-03-15T10:00:00",
		allDay: false,
		backgroundColor: "#3788d8",
		borderColor: "#3788d8",
		className: "regular-event",
		extendedProps: {
			filePath: "events/test.md",
			folder: "events",
			originalTitle: "Event",
			frontmatterDisplayData: {},
			virtualKind: "none",
		},
		...overrides,
	} as PrismaEventInput;
}

/** Build the `previous` map that `diffEvents` expects, from an array of events. */
export function buildPreviousMap(events: PrismaEventInput[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const ev of events) {
		map.set(ev.id as string, eventFingerprint(ev));
	}
	return map;
}
