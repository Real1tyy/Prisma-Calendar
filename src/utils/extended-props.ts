import { z } from "zod";

import type { Frontmatter } from "../types";
import { type VirtualKind, VirtualKindSchema } from "../types/calendar";

// ─── Boundary Schema ─────────────────────────────────────────────────
// Validates and transforms FullCalendar's untyped extendedProps bag into
// clean typed data. Used at every boundary where FullCalendar events
// enter our code (callbacks, event mounting, batch operations).
//
// Parse once at the boundary → trust the types everywhere inside.

export const FCExtendedPropsSchema = z.object({
	filePath: z.string().catch(""),
	folder: z.string().catch(""),
	originalTitle: z.string().catch(""),
	frontmatterDisplayData: z.record(z.string(), z.unknown()).catch({}),
	virtualKind: VirtualKindSchema.catch("none"),
	virtualEventId: z.string().optional().catch(undefined),
	computedColors: z.array(z.string()).optional().catch(undefined),
	frontmatterHash: z.number().optional().catch(undefined),
	skipped: z.boolean().catch(false),
});

export type FCExtendedProps = z.infer<typeof FCExtendedPropsSchema>;

// ─── Boundary Parse ──────────────────────────────────────────────────

type AnyEvent = { extendedProps?: Record<string, unknown> | object };

/**
 * Parse FullCalendar extendedProps through Zod at the boundary.
 * Call once per callback entry point — downstream code uses the typed result.
 */
export function parseFCExtendedProps(event: AnyEvent): FCExtendedProps {
	return FCExtendedPropsSchema.parse(event.extendedProps ?? {});
}

// ─── Convenience Accessors ───────────────────────────────────────────
// Thin wrappers for call sites that only need a single field.
// Each still validates through the schema.

export function getVirtualKind(event: AnyEvent): VirtualKind {
	const raw = (event.extendedProps ?? {}) as Record<string, unknown>;
	return VirtualKindSchema.catch("none").parse(raw["virtualKind"]);
}

export function getFilePath(event: AnyEvent): string | undefined {
	const raw = (event.extendedProps ?? {}) as Record<string, unknown>;
	return typeof raw["filePath"] === "string" ? raw["filePath"] : undefined;
}

export function getDisplayData(event: AnyEvent): Frontmatter {
	const raw = (event.extendedProps ?? {}) as Record<string, unknown>;
	return (raw["frontmatterDisplayData"] ?? {}) as Frontmatter;
}
