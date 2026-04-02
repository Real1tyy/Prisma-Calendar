import type { Frontmatter } from "../types";
import { type VirtualKind, VirtualKindSchema } from "../types/calendar";

/**
 * Typed result of extracting FullCalendar extendedProps.
 * All fields are guaranteed present (non-optional) to eliminate null checks at call sites.
 */
export interface ExtractedExtendedProps {
	filePath: string;
	folder: string;
	originalTitle: string;
	frontmatterDisplayData: Frontmatter;
	virtualKind: VirtualKind;
	virtualEventId: string | undefined;
	computedColors: string[] | undefined;
	frontmatterHash: number | undefined;
}

/**
 * Type-safe accessor for FullCalendar extendedProps.
 * Accepts any object shape that has an `extendedProps` property (FullCalendar EventApi,
 * CalendarEventData, or any duck-typed equivalent).
 * Validates `virtualKind` through Zod — all other fields use typeof guards.
 */
export function getExtendedProps(event: { extendedProps?: Record<string, unknown> | object }): ExtractedExtendedProps {
	const ep: Record<string, unknown> = (event.extendedProps ?? {}) as Record<string, unknown>;

	return {
		filePath: typeof ep["filePath"] === "string" ? ep["filePath"] : "",
		folder: typeof ep["folder"] === "string" ? ep["folder"] : "",
		originalTitle: typeof ep["originalTitle"] === "string" ? ep["originalTitle"] : "",
		frontmatterDisplayData: (ep["frontmatterDisplayData"] ?? {}) as Frontmatter,
		virtualKind: VirtualKindSchema.catch("none").parse(ep["virtualKind"]),
		virtualEventId: typeof ep["virtualEventId"] === "string" ? ep["virtualEventId"] : undefined,
		computedColors: Array.isArray(ep["computedColors"]) ? (ep["computedColors"] as string[]) : undefined,
		frontmatterHash: typeof ep["frontmatterHash"] === "number" ? ep["frontmatterHash"] : undefined,
	};
}

/** Shorthand: extract just the virtualKind from an event's extendedProps. */
export function getVirtualKind(event: { extendedProps?: Record<string, unknown> | object }): VirtualKind {
	const ep: Record<string, unknown> = (event.extendedProps ?? {}) as Record<string, unknown>;
	return VirtualKindSchema.catch("none").parse(ep["virtualKind"]);
}

/** Shorthand: extract just the filePath from an event's extendedProps. */
export function getFilePath(event: { extendedProps?: Record<string, unknown> | object }): string | undefined {
	const ep: Record<string, unknown> = (event.extendedProps ?? {}) as Record<string, unknown>;
	return typeof ep["filePath"] === "string" ? ep["filePath"] : undefined;
}

/** Shorthand: extract the frontmatter display data from an event's extendedProps. */
export function getDisplayData(event: { extendedProps?: Record<string, unknown> | object }): Frontmatter {
	const ep: Record<string, unknown> = (event.extendedProps ?? {}) as Record<string, unknown>;
	return (ep["frontmatterDisplayData"] ?? {}) as Frontmatter;
}
