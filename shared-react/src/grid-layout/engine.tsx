import { createCssUtils, showModal } from "@real1ty-obsidian-plugins";
import { setIcon } from "obsidian";
import { type CSSProperties, memo, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import type { CellEntry, EngineCore } from "./engine-core";
import { defaultSizes, sizesToTemplate } from "./engine-state";
import { GridResizeHandles } from "./grid-resize-handles";
import type { ResizeMode } from "./types";

function emptyElement(el: HTMLElement): void {
	while (el.firstChild) el.removeChild(el.firstChild);
}

type PerCellAxis = "row" | "col";

const PER_CELL_AXIS_CONFIG = {
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

function buildGridStyleVars(
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
	return vars as CSSProperties;
}

function bucketCellsByAxis(
	cells: ReadonlyArray<CellEntry>,
	axis: PerCellAxis,
	count: number
): { containers: CellEntry[][]; orphans: CellEntry[] } {
	const containers: CellEntry[][] = Array.from({ length: count }, () => []);
	const orphans: CellEntry[] = [];
	for (const entry of cells) {
		const idx = axis === "row" ? entry.row : entry.col;
		if (idx >= 0 && idx < count) containers[idx].push(entry);
		else orphans.push(entry);
	}
	return { containers, orphans };
}

export interface GridEngineViewProps {
	core: EngineCore;
}

export const GridEngineView = memo(function GridEngineView({ core }: GridEngineViewProps) {
	const snapshot = useSyncExternalStore(core.subscribe, core.getSnapshot);
	const { config } = core;
	const { cssPrefix, gap, minCellWidth, dividers, editable, resizable, cellPalette, app } = config;

	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);

	const gridElRef = useRef<HTMLDivElement>(null);
	const rowContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
	const colContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

	if (snapshot.destroyed) return null;

	const perCellMode: PerCellAxis | null =
		resizable === "cell-width" ? "row" : resizable === "cell-height" ? "col" : null;
	const trackMode = resizable === "track";
	const isResizable = resizable !== undefined;
	const showTrackHandles = isResizable && !minCellWidth;

	const { cols, rows, cells, ghostKeys, columnSizes, rowSizes, cellColumnSizes, cellRowSizes } = snapshot;

	const gridStyle = buildGridStyleVars(cols, rows, columnSizes, rowSizes, gap, minCellWidth, resizable);

	const hasPalette = (cellPalette?.length ?? 0) > 0;
	const showEditButton = editable === true && hasPalette && config.onOpenLayoutEditor !== undefined;

	const perCellCount = perCellMode === "row" ? rows : perCellMode === "col" ? cols : 0;
	const { containers: containerCells, orphans: directCells } = perCellMode
		? bucketCellsByAxis(cells, perCellMode, perCellCount)
		: { containers: [], orphans: [...cells] };

	const onOpenEnlarge = app
		? (entry: CellEntry): void => {
				showModal({
					app,
					cls: css.cls("grid-enlarge-modal"),
					title: entry.enlargeTitle ?? entry.id ?? "",
					render: (modalEl: HTMLElement) => entry.render(modalEl),
				});
			}
		: undefined;

	const colHandleCount = trackMode ? (columnSizes?.length ?? cols) - 1 : resizable === "cell-height" ? cols - 1 : 0;
	const rowHandleCount = trackMode ? (rowSizes?.length ?? rows) - 1 : resizable === "cell-width" ? rows - 1 : 0;

	return (
		<div className={css.cls("grid")} style={gridStyle} ref={gridElRef}>
			{perCellMode &&
				containerCells.map((axisCells, idx) => {
					const innerCount = perCellMode === "row" ? cols : rows;
					const innerSizes = perCellMode === "row" ? cellColumnSizes?.[String(idx)] : cellRowSizes?.[String(idx)];
					const commitInner = (sizes: number[]): void => {
						if (perCellMode === "row") core.commitCellColumnSizes(idx, sizes);
						else core.commitCellRowSizes(idx, sizes);
					};
					const containerRefs = perCellMode === "row" ? rowContainerRefs : colContainerRefs;
					return (
						<PerCellContainer
							key={`${PER_CELL_AXIS_CONFIG[perCellMode].keyPrefix}${idx}`}
							core={core}
							css={css}
							cssPrefix={cssPrefix}
							axis={perCellMode}
							cells={axisCells}
							innerCount={innerCount}
							innerSizes={innerSizes}
							gap={gap}
							dividers={dividers === true}
							hasPalette={hasPalette}
							onOpenEnlarge={onOpenEnlarge}
							setContainerEl={(el) => {
								containerRefs.current[idx] = el;
							}}
							getContainerEl={() => containerRefs.current[idx]}
							onCommitInner={commitInner}
						/>
					);
				})}

			{!perCellMode &&
				directCells.map((entry) => (
					<GridCell
						key={entry.instanceId}
						entry={entry}
						core={core}
						cssPrefix={cssPrefix}
						dividers={dividers === true}
						hasPalette={hasPalette}
						onOpenEnlarge={onOpenEnlarge}
						perCell={false}
					/>
				))}
			{!perCellMode &&
				Array.from(ghostKeys).map((key) => {
					const [r, c] = key.split(":").map(Number);
					return <GhostCell key={`ghost-${r}-${c}`} cssPrefix={cssPrefix} row={r} col={c} />;
				})}

			{showEditButton && <EditButton cssPrefix={cssPrefix} onClick={() => core.handle.showLayoutEditor()} />}

			{showTrackHandles && colHandleCount > 0 && (
				<GridResizeHandles
					cssPrefix={cssPrefix}
					getContainer={() => gridElRef.current}
					axis="col"
					count={colHandleCount}
					getSizes={() => snapshot.columnSizes ?? defaultSizes(cols)}
					onSizesChange={(sizes) => core.commitColumnSizes(sizes)}
				/>
			)}
			{showTrackHandles && rowHandleCount > 0 && (
				<GridResizeHandles
					cssPrefix={cssPrefix}
					getContainer={() => gridElRef.current}
					axis="row"
					count={rowHandleCount}
					getSizes={() => snapshot.rowSizes ?? defaultSizes(rows)}
					onSizesChange={(sizes) => core.commitRowSizes(sizes)}
				/>
			)}
		</div>
	);
});

interface PerCellContainerProps {
	core: EngineCore;
	css: ReturnType<typeof createCssUtils>;
	cssPrefix: string;
	axis: PerCellAxis;
	cells: CellEntry[];
	innerCount: number;
	innerSizes: number[] | undefined;
	gap: string | undefined;
	dividers: boolean;
	hasPalette: boolean;
	onOpenEnlarge: ((entry: CellEntry) => void) | undefined;
	setContainerEl: (el: HTMLDivElement | null) => void;
	getContainerEl: () => HTMLDivElement | null;
	onCommitInner: (sizes: number[]) => void;
}

function PerCellContainer({
	core,
	css,
	cssPrefix,
	axis,
	cells,
	innerCount,
	innerSizes,
	gap,
	dividers,
	hasPalette,
	onOpenEnlarge,
	setContainerEl,
	getContainerEl,
	onCommitInner,
}: PerCellContainerProps) {
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

	return (
		<div ref={setContainerEl} className={css.cls(axisCfg.cls)} style={containerStyle}>
			{cells.map((entry) => (
				<GridCell
					key={entry.instanceId}
					entry={entry}
					core={core}
					cssPrefix={cssPrefix}
					dividers={dividers}
					hasPalette={hasPalette}
					onOpenEnlarge={onOpenEnlarge}
					perCell
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

interface GridCellProps {
	entry: CellEntry;
	core: EngineCore;
	cssPrefix: string;
	dividers: boolean;
	hasPalette: boolean;
	onOpenEnlarge: ((entry: CellEntry) => void) | undefined;
	perCell: boolean;
}

function GridCell({ entry, core, cssPrefix, dividers, hasPalette, onOpenEnlarge, perCell }: GridCellProps) {
	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);
	const elRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = elRef.current;
		if (!el) return;

		const hasPicker = hasPalette && core.config.onOpenCellPicker !== undefined;
		if (hasPicker) {
			const btn = document.createElement("button");
			btn.className = css.cls("grid-cell-swap");
			setIcon(btn, "arrow-left-right");
			btn.addEventListener("click", () => core.handle.showCellPicker(entry.row, entry.col));
			el.appendChild(btn);
		}
		if (entry.enlargeable && onOpenEnlarge) {
			const btn = document.createElement("button");
			btn.className = css.cls("grid-cell-enlarge");
			setIcon(btn, "maximize-2");
			btn.addEventListener("click", () => onOpenEnlarge(entry));
			el.appendChild(btn);
		}

		void entry.render(el);

		return () => {
			// Consumer cleanups commonly call root.unmount() on a nested React root
			// (renderReactInline pattern). Running that inside React's outer commit
			// phase corrupts the outer commit and produces "node to be removed is not
			// a child of this node" crashes. Defer to a microtask so the nested
			// unmount happens after the outer commit finishes.
			//
			// When the consumer provides a cleanup, trust it to fully clear the cell —
			// skip emptyElement so we don't race against the deferred unmount. When
			// there is no cleanup, the cell is purely imperative DOM; empty it sync.
			const cleanup = entry.cleanup;
			if (cleanup) {
				queueMicrotask(cleanup);
			} else {
				emptyElement(el);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- per-instance effect; mounting handled by React's key on entry.instanceId
	}, [entry.instanceId]);

	const cellClasses = [css.cls("grid-cell")];
	if (dividers) cellClasses.push(css.cls("grid-cell-divider"));
	if (entry.enlargeable && hasPalette) cellClasses.push(css.cls("grid-cell-enlargeable"));

	const cellStyle: CSSProperties = {};
	if (perCell) {
		cellStyle.minWidth = "0";
		cellStyle.minHeight = "0";
	} else {
		(cellStyle as Record<string, string>)["--cell-row"] = `${entry.row + 1} / span ${entry.rowSpan ?? 1}`;
		(cellStyle as Record<string, string>)["--cell-col"] = `${entry.col + 1} / span ${entry.colSpan ?? 1}`;
	}

	return (
		<div
			ref={(el) => {
				elRef.current = el;
				core.registerElement(entry.instanceId, el);
			}}
			className={cellClasses.join(" ")}
			data-row={entry.row}
			data-col={entry.col}
			style={cellStyle}
		/>
	);
}

interface GhostCellProps {
	cssPrefix: string;
	row: number;
	col: number;
}

function GhostCell({ cssPrefix, row, col }: GhostCellProps) {
	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);
	return <div className={css.cls("grid-cell")} data-row={row} data-col={col} />;
}

interface EditButtonProps {
	cssPrefix: string;
	onClick: () => void;
}

function EditButton({ cssPrefix, onClick }: EditButtonProps) {
	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);
	const ref = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, "settings-2");
	}, []);
	return <button ref={ref} className={css.cls("grid-edit-btn")} onClick={onClick} type="button" />;
}
