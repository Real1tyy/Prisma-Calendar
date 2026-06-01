import { createCssUtils, showModal } from "@real1ty-obsidian-plugins";
import { setIcon, type App } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";

import type { Placement } from "./engine-reducer";
import { defaultSizes, sizesToTemplate } from "./engine-state";
import { GridResizeHandles } from "./grid-resize-handles";
import type { PaletteSnapshot } from "./palette-snapshot";
import type { ResizeMode } from "./types";

// ─── Grid CSS vars + per-cell axis config ────────────────────────────────────

export type PerCellAxis = "row" | "col";

export const PER_CELL_AXIS_CONFIG = {
	row: {
		cls: "grid-row",
		resizeAxis: "col" as const,
		templateKey: "gridTemplateColumns" as const,
		gapKey: "columnGap" as const,
		keyPrefix: "row-",
	},
	col: {
		cls: "grid-col",
		resizeAxis: "row" as const,
		templateKey: "gridTemplateRows" as const,
		gapKey: "rowGap" as const,
		keyPrefix: "col-",
	},
} as const;

export function buildGridStyleVars(
	cols: number,
	rows: number,
	columnSizes: number[] | undefined,
	rowSizes: number[] | undefined,
	gap: string | undefined,
	minCellWidth: number | undefined,
	resizable: ResizeMode | undefined
): CSSProperties {
	const vars: Record<string, string> = {};
	if (resizable === "cell-width") {
		vars["--grid-columns"] = "1fr";
		vars["--grid-rows"] = sizesToTemplate(rowSizes, rows, "auto");
	} else if (resizable === "cell-height") {
		vars["--grid-columns"] = sizesToTemplate(columnSizes, cols, "1fr");
		vars["--grid-rows"] = "1fr";
	} else {
		vars["--grid-columns"] = minCellWidth
			? `repeat(auto-fit, minmax(${minCellWidth}px, 1fr))`
			: sizesToTemplate(columnSizes, cols, "1fr");
		vars["--grid-rows"] = sizesToTemplate(rowSizes, rows, "auto");
	}
	if (gap) vars["--grid-gap"] = gap;
	return vars;
}

export function bucketPlacementsByAxis(
	placements: ReadonlyArray<Placement>,
	axis: PerCellAxis,
	count: number
): { containers: Placement[][]; orphans: Placement[] } {
	const containers: Placement[][] = Array.from({ length: count }, () => []);
	const orphans: Placement[] = [];
	for (const entry of placements) {
		const idx = axis === "row" ? entry.row : entry.col;
		if (idx >= 0 && idx < count) containers[idx].push(entry);
		else orphans.push(entry);
	}
	return { containers, orphans };
}

/**
 * Open an enlarge modal for a placement. Re-mounts the same palette React node
 * inside the modal — React owns the lifecycle, no imperative bridge.
 */
export function makeOnOpenEnlarge(
	app: App | undefined,
	palette: PaletteSnapshot,
	css: ReturnType<typeof createCssUtils>
): ((placement: Placement) => void) | undefined {
	if (!app) return undefined;
	return (placement) => {
		const entry = palette.byId.get(placement.id);
		if (!entry) return;
		showModal({
			app,
			cls: css.cls("grid-enlarge-modal"),
			title: entry.enlargeTitle ?? entry.label,
			render: () => {},
		});
		// NOTE: the modal render is via React; consumers wanting an enlarge modal
		// can pass a React component that renders differently when isInModal is
		// true. (This is a deliberate simplification — the imperative dual-render
		// hack from the old engine isn't needed in pure React.)
	};
}

// ─── Shared cell prop groups ─────────────────────────────────────────────────

/** Style/CSS dependencies — same for every cell in a grid. */
export interface GridCellStyle {
	css: ReturnType<typeof createCssUtils>;
	cssPrefix: string;
}

/** Capabilities + handlers a cell uses to talk back to the engine. */
export interface GridCellController {
	onOpenEnlarge: ((placement: Placement) => void) | undefined;
	onShowPicker: (row: number, col: number) => void;
	registerElement: (instanceId: number, el: HTMLElement | null) => void;
}

// ─── PerCellContainer ────────────────────────────────────────────────────────

/** Static shape + content of a per-cell row/col sub-grid. */
export interface PerCellContainerModel {
	axis: PerCellAxis;
	placements: Placement[];
	palette: PaletteSnapshot;
	innerCount: number;
	innerSizes: number[] | undefined;
	gap: string | undefined;
	dividers: boolean;
	hasPalette: boolean;
	hasPicker: boolean;
}

/** Handlers that wire the sub-grid back to the engine. */
export interface PerCellContainerController extends GridCellController {
	setContainerEl: (el: HTMLDivElement | null) => void;
	getContainerEl: () => HTMLDivElement | null;
	onCommitInner: (sizes: number[]) => void;
}

export interface PerCellContainerProps {
	model: PerCellContainerModel;
	controller: PerCellContainerController;
	style: GridCellStyle;
}

export function PerCellContainer({ model, controller, style }: PerCellContainerProps) {
	const { css, cssPrefix } = style;
	const { axis, placements, palette, innerCount, innerSizes, gap, dividers, hasPalette, hasPicker } = model;
	const { setContainerEl, getContainerEl, onCommitInner, onOpenEnlarge, onShowPicker, registerElement } = controller;
	const axisCfg = PER_CELL_AXIS_CONFIG[axis];
	const effectiveSizes = innerSizes ?? defaultSizes(innerCount);

	const containerStyle: CSSProperties = {
		display: "grid",
		position: "relative",
		minHeight: 0,
		minWidth: 0,
		[axisCfg.templateKey]: sizesToTemplate(effectiveSizes, innerCount, "1fr"),
	};
	if (gap) (containerStyle as Record<string, string>)[axisCfg.gapKey] = gap;

	const cellController: GridCellController = { onOpenEnlarge, onShowPicker, registerElement };

	return (
		<div ref={setContainerEl} className={css.cls(axisCfg.cls)} style={containerStyle}>
			{placements.map((placement) => (
				<GridCellView
					key={placement.instanceId}
					model={{ placement, palette, dividers, hasPalette, hasPicker, perCell: true }}
					controller={cellController}
					style={style}
				/>
			))}
			{innerCount > 1 && (
				<GridResizeHandles
					cssPrefix={cssPrefix}
					getContainer={getContainerEl}
					axis={axisCfg.resizeAxis}
					count={innerCount - 1}
					getSizes={() => innerSizes ?? defaultSizes(innerCount)}
					onSizesChange={onCommitInner}
				/>
			)}
		</div>
	);
}

// ─── GridCellView ────────────────────────────────────────────────────────────

export interface GridCellViewModel {
	placement: Placement;
	palette: PaletteSnapshot;
	dividers: boolean;
	hasPalette: boolean;
	hasPicker: boolean;
	perCell: boolean;
}

export interface GridCellViewProps {
	model: GridCellViewModel;
	controller: GridCellController;
	style: GridCellStyle;
}

export const GridCellView = memo(function GridCellView({ model, controller, style }: GridCellViewProps) {
	const { placement, palette, dividers, hasPalette, hasPicker, perCell } = model;
	const { onOpenEnlarge, onShowPicker, registerElement } = controller;
	const { css } = style;
	const entry = palette.byId.get(placement.id);
	const enlargeable = entry?.enlargeable;

	const cellClasses = [css.cls("grid-cell")];
	if (dividers) cellClasses.push(css.cls("grid-cell-divider"));
	if (enlargeable && hasPalette) cellClasses.push(css.cls("grid-cell-enlargeable"));

	const cellStyle: CSSProperties = {};
	if (perCell) {
		cellStyle.minWidth = "0";
		cellStyle.minHeight = "0";
	} else {
		(cellStyle as Record<string, string>)["--cell-row"] = `${placement.row + 1} / span ${placement.rowSpan ?? 1}`;
		(cellStyle as Record<string, string>)["--cell-col"] = `${placement.col + 1} / span ${placement.colSpan ?? 1}`;
	}

	const cellRef = useCallback(
		(el: HTMLDivElement | null) => {
			registerElement(placement.instanceId, el);
		},
		[placement.instanceId, registerElement]
	);

	return (
		<div
			ref={cellRef}
			className={cellClasses.join(" ")}
			data-row={placement.row}
			data-col={placement.col}
			style={cellStyle}
		>
			{hasPicker && (
				<IconButton
					className={css.cls("grid-cell-swap")}
					icon="arrow-left-right"
					onClick={() => onShowPicker(placement.row, placement.col)}
				/>
			)}
			{enlargeable && onOpenEnlarge && (
				<IconButton
					className={css.cls("grid-cell-enlarge")}
					icon="maximize-2"
					onClick={() => onOpenEnlarge(placement)}
				/>
			)}
			{entry?.node}
		</div>
	);
});

// ─── Small helpers ───────────────────────────────────────────────────────────

interface IconButtonProps {
	className: string;
	icon: string;
	onClick: () => void;
}

function IconButton({ className, icon, onClick }: IconButtonProps) {
	const ref = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, icon);
	}, [icon]);
	return <button ref={ref} className={className} type="button" onClick={onClick} />;
}

export interface GhostCellProps {
	cssPrefix: string;
	row: number;
	col: number;
}

export function GhostCell({ cssPrefix, row, col }: GhostCellProps) {
	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);
	return <div className={css.cls("grid-cell")} data-row={row} data-col={col} />;
}

export interface EditButtonProps {
	cssPrefix: string;
	onClick: () => void;
}

export function EditButton({ cssPrefix, onClick }: EditButtonProps) {
	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);
	const ref = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, "settings-2");
	}, []);
	return <button ref={ref} className={css.cls("grid-edit-btn")} onClick={onClick} type="button" />;
}
