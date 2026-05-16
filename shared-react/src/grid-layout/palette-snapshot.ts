import type { ReactNode } from "react";

import type { CellChildSpec } from "./cell";
import type { CellOption } from "./types";

/** Internal palette entry — derived from each `<Cell>` child. */
export interface PaletteEntry {
	id: string;
	label: string;
	enlargeable: boolean | undefined;
	enlargeTitle: string | undefined;
	node: ReactNode;
}

export interface PaletteSnapshot {
	/** Lookup for rendering: id → React subtree to mount inside the cell `<div>`. */
	byId: Map<string, PaletteEntry>;
	/** Ordered palette shown to the user in the picker / layout editor. */
	pickerEntries: PaletteEntry[];
	/** Default placements: every `<Cell>` that isn't `paletteOnly`, in declaration order. */
	defaultPlacements: ReadonlyArray<{
		id: string;
		row: number;
		col: number;
		rowSpan: number | undefined;
		colSpan: number | undefined;
	}>;
}

/**
 * Walk the `<Cell>` child specs and assemble the palette snapshot the engine
 * uses for lookup, picker display, and initial placement.
 */
export function buildPaletteFromChildren(specs: CellChildSpec[], cols: number, rows: number): PaletteSnapshot {
	const entries: PaletteEntry[] = specs.map((spec) => ({
		id: spec.id,
		label: spec.label,
		enlargeable: spec.enlargeable,
		enlargeTitle: spec.enlargeTitle,
		node: spec.children,
	}));
	const byId = new Map(entries.map((e) => [e.id, e]));

	let autoIndex = 0;
	const defaultPlacements: {
		id: string;
		row: number;
		col: number;
		rowSpan: number | undefined;
		colSpan: number | undefined;
	}[] = [];
	for (const spec of specs) {
		if (spec.paletteOnly) continue;
		const row = spec.row ?? Math.floor(autoIndex / cols);
		const col = spec.col ?? autoIndex % cols;
		autoIndex++;
		if (row >= rows || col >= cols) continue;
		defaultPlacements.push({
			id: spec.id,
			row,
			col,
			rowSpan: spec.rowSpan,
			colSpan: spec.colSpan,
		});
	}

	return { byId, pickerEntries: entries, defaultPlacements };
}

/**
 * Synthesize `CellOption[]` for the picker / layout editor modals (which still
 * accept the legacy shape). `render` is a no-op because applyState dispatches
 * structural changes and the actual cell content is mounted by the engine via
 * palette lookup.
 */
export function paletteToCellOptions(palette: PaletteSnapshot): CellOption[] {
	return palette.pickerEntries.map((entry) => ({
		id: entry.id,
		label: entry.label,
		...(entry.enlargeable !== undefined ? { enlargeable: entry.enlargeable } : {}),
		...(entry.enlargeTitle !== undefined ? { enlargeTitle: entry.enlargeTitle } : {}),
		render: () => {},
	}));
}
