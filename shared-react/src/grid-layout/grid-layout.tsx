import { createCssUtils } from "@real1ty-obsidian-plugins";
import type { App, Plugin } from "obsidian";
import {
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useReducer,
	useRef,
	type HTMLAttributes,
	type ReactNode,
	type Ref,
} from "react";
import { flushSync } from "react-dom";

import { walkCellChildren } from "./cell";
import { openCellPicker } from "./cell-picker-modal";
import { registerGridCommands } from "./commands";
import {
	buildInitialState,
	buildPublicState,
	findPlacementAt,
	reducer,
	type Action,
	type Placement,
} from "./engine-reducer";
import { defaultSizes } from "./engine-state";
import {
	bucketPlacementsByAxis,
	buildGridStyleVars,
	EditButton,
	GhostCell,
	GridCellView,
	PER_CELL_AXIS_CONFIG,
	PerCellContainer,
	type GridCellController,
	type GridCellStyle,
	type PerCellAxis,
} from "./grid-cell-view";
import { GridResizeHandles } from "./grid-resize-handles";
import { openLayoutEditor } from "./layout-editor-modal";
import { buildPaletteFromChildren, paletteToCellOptions, type PaletteSnapshot } from "./palette-snapshot";
import { injectGridStyles } from "./styles";
import type { CellOption, GridLayoutConfig, GridLayoutHandle, GridLayoutState, ResizeMode } from "./types";

/**
 * Capture the latest value of `value` in a ref each render. Updates the ref in
 * an effect so React's strict refs rule stays happy — consumers must only read
 * the ref from event handlers / effect bodies (not during render).
 */
function useLatestRef<T>(value: T): { current: T } {
	const ref = useRef(value);
	useEffect(() => {
		ref.current = value;
	});
	return ref;
}

interface InitEngineArg {
	columns: number;
	rows: number;
	resizable: ResizeMode | undefined;
	initialState: GridLayoutState | undefined;
	palette: PaletteSnapshot;
}

/** Adapter so `useReducer(_, arg, init)` can call `buildInitialState` directly. */
function initEngineState(arg: InitEngineArg) {
	return buildInitialState({
		cols: arg.columns,
		rows: arg.rows,
		resizable: arg.resizable,
		initialState: arg.initialState,
		knownIds: new Set(arg.palette.byId.keys()),
		defaultPlacements: arg.palette.defaultPlacements,
	});
}

export interface GridLayoutCommandsConfig {
	plugin: Plugin;
	id: string;
	label: string;
}

type DivAttributes = Omit<HTMLAttributes<HTMLDivElement>, "children">;

export interface GridLayoutProps extends DivAttributes {
	/** React `<Cell>` children — the grid's content. */
	children?: ReactNode;
	cssPrefix: string;
	columns: number;
	rows: number;
	gap?: string;
	minCellWidth?: number;
	dividers?: boolean;
	/** When true, render a gear button to open the layout editor. Requires `app`. */
	editable?: boolean;
	resizable?: ResizeMode;
	/** Required when using picker/enlarge/editor modals. */
	app?: App;
	/** Persisted layout to restore. */
	initialState?: GridLayoutState;
	/** Fires on any structural mutation (swap, resize, applyState, size commits). */
	onStateChange?: (state: GridLayoutState) => void;
	/** Override the default cell-picker modal. */
	onOpenCellPicker?: GridLayoutConfig["onOpenCellPicker"];
	/** Override the default layout-editor modal. */
	onOpenLayoutEditor?: GridLayoutConfig["onOpenLayoutEditor"];
	commands?: GridLayoutCommandsConfig;
	/** Fires once on mount with the imperative handle. Return a cleanup if you need one. */
	onReady?: (handle: GridLayoutHandle) => (() => void) | void;
	/** External imperative handle (uncommon — prefer `onReady`). */
	handleRef?: Ref<GridLayoutHandle>;
}

export const GridLayout = memo(function GridLayout(props: GridLayoutProps) {
	const {
		children,
		commands,
		onReady,
		handleRef,
		app,
		cssPrefix,
		columns,
		rows,
		gap,
		minCellWidth,
		dividers,
		editable,
		resizable,
		initialState,
		onStateChange,
		onOpenLayoutEditor,
		onOpenCellPicker,
		// Pulled out so they don't end up in `{...rest}` and clobber the engine's
		// own className/style (which carry the grid CSS class and --grid-columns /
		// --grid-rows custom properties). Consumer values are merged below.
		style: consumerStyle,
		className: consumerClassName,
		...rest
	} = props;

	const childSpecs = useMemo(() => walkCellChildren(children), [children]);
	const palette = useMemo(() => buildPaletteFromChildren(childSpecs, columns, rows), [childSpecs, columns, rows]);

	// Default state used by the layout editor's Reset button — represents the
	// pristine layout dictated by `<Cell>` declarations + the prop-level columns/
	// rows, ignoring any persisted state.
	const defaultState = useMemo<GridLayoutState>(
		() => ({
			columns,
			rows,
			cells: palette.defaultPlacements.map((p) => ({ optionId: p.id, row: p.row, col: p.col })),
			columnSizes: undefined,
			rowSizes: undefined,
			cellColumnSizes: undefined,
			cellRowSizes: undefined,
		}),
		[columns, rows, palette.defaultPlacements]
	);
	const defaultStateRef = useLatestRef(defaultState);

	// One-shot reducer initialization: the third arg to useReducer is `init(initialArg)`,
	// called once on first render. `columns`, `rows`, `resizable`, `initialState`, and the
	// initial palette only seed state — later changes do NOT re-init. Force a full rebuild
	// by remounting with a different `key`. (`columns`/`rows` changes are picked up by the
	// resize effect below.)
	const [state, reactDispatch] = useReducer(
		reducer,
		{ columns, rows, resizable, initialState, palette },
		initEngineState
	);

	// Mirror reducer state in a ref updated synchronously on every dispatch so the
	// imperative handle's getters reflect the new state immediately after a mutation,
	// before React commits the re-render.
	const syncStateRef = useRef(state);
	const dispatch = useCallback((action: Action) => {
		syncStateRef.current = reducer(syncStateRef.current, action);
		reactDispatch(action);
	}, []);

	// Latest-prop refs so the durable imperative handle reads current values.
	const onStateChangeRef = useLatestRef(onStateChange);
	const resizableRef = useLatestRef(resizable);

	// Emit onStateChange when serializable state changes (skip first render).
	const hasMountedRef = useRef(false);
	useEffect(() => {
		if (!hasMountedRef.current) {
			hasMountedRef.current = true;
			return;
		}
		onStateChangeRef.current?.(buildPublicState(syncStateRef.current, resizableRef.current));
	}, [
		state.cols,
		state.rows,
		state.placements,
		state.columnSizes,
		state.rowSizes,
		state.cellColumnSizes,
		state.cellRowSizes,
		onStateChangeRef,
		resizableRef,
	]);

	// Resize on dimension prop change.
	useEffect(() => {
		if (syncStateRef.current.cols !== columns || syncStateRef.current.rows !== rows) {
			dispatch({ type: "resize", cols: columns, rows: rows });
		}
	}, [columns, rows, dispatch]);

	// Default modal openers when `app` is provided.
	const resolvedOpenLayoutEditor = useMemo<GridLayoutConfig["onOpenLayoutEditor"] | undefined>(() => {
		if (onOpenLayoutEditor) return onOpenLayoutEditor;
		if (!app) return undefined;
		return (currentState, paletteOpts, applyState, defaultState) =>
			openLayoutEditor(app, {
				cssPrefix,
				initialState: currentState,
				cellPalette: paletteOpts,
				onApply: applyState,
				defaultState,
			});
	}, [app, cssPrefix, onOpenLayoutEditor]);

	const resolvedOpenCellPicker = useMemo<GridLayoutConfig["onOpenCellPicker"] | undefined>(() => {
		if (onOpenCellPicker) return onOpenCellPicker;
		if (!app) return undefined;
		return (row, col, currentId, usedIds, paletteOpts, selectOption) =>
			openCellPicker(app, {
				cssPrefix,
				row,
				col,
				cellPalette: paletteOpts,
				currentId,
				usedIds,
				onSelect: (optionId) => {
					const option = paletteOpts.find((o) => o.id === optionId);
					if (option) selectOption(option);
				},
			});
	}, [app, cssPrefix, onOpenCellPicker]);

	const resolvedOpenLayoutEditorRefInternal = useLatestRef(resolvedOpenLayoutEditor);
	const resolvedOpenCellPickerRefInternal = useLatestRef(resolvedOpenCellPicker);

	const cellOptionPalette = useMemo<CellOption[]>(() => paletteToCellOptions(palette), [palette]);
	const cellOptionPaletteRef = useLatestRef(cellOptionPalette);

	// Stable element map for handle.getCellElement.
	const elementMap = useRef(new Map<number, HTMLElement>());
	const registerElement = useCallback((instanceId: number, el: HTMLElement | null) => {
		if (el === null) elementMap.current.delete(instanceId);
		else elementMap.current.set(instanceId, el);
	}, []);

	const handle = useMemo<GridLayoutHandle>(
		() => ({
			get columns() {
				return syncStateRef.current.cols;
			},
			get rows() {
				return syncStateRef.current.rows;
			},
			setCell() {
				/* Removed: array-API leftover. Re-render with different <Cell> children to change content. */
			},
			setCellById() {
				/* Removed: same reason. */
			},
			clearCell(row, col) {
				dispatch({ type: "clearCell", row, col });
			},
			getCellElement(row, col) {
				const entry = findPlacementAt(syncStateRef.current, row, col);
				if (!entry) return null;
				return elementMap.current.get(entry.instanceId) ?? null;
			},
			resize(newCols, newRows) {
				dispatch({ type: "resize", cols: newCols, rows: newRows });
			},
			showCellPicker(row, col) {
				const openPicker = resolvedOpenCellPickerRefInternal.current;
				const paletteOpts = cellOptionPaletteRef.current;
				if (!openPicker || paletteOpts.length === 0) return;
				const current = findPlacementAt(syncStateRef.current, row, col);
				const currentId = current?.id;
				const usedIds = new Set(syncStateRef.current.placements.map((p) => p.id));
				openPicker(row, col, currentId, usedIds, paletteOpts, (option) => {
					dispatch({ type: "swapCell", row, col, optionId: option.id });
				});
			},
			showLayoutEditor() {
				const openEditor = resolvedOpenLayoutEditorRefInternal.current;
				const paletteOpts = cellOptionPaletteRef.current;
				if (!openEditor || paletteOpts.length === 0) return;
				openEditor(
					buildPublicState(syncStateRef.current, resizableRef.current),
					paletteOpts,
					(next) => {
						// flushSync so DOM reflects the new layout before applyState returns —
						// safe here because applyState fires from a modal action handler.
						flushSync(() => {
							dispatch({ type: "applyState", state: next });
						});
					},
					defaultStateRef.current
				);
			},
			getState() {
				return buildPublicState(syncStateRef.current, resizableRef.current);
			},
			destroy() {
				dispatch({ type: "destroy" });
			},
		}),
		[
			dispatch,
			resizableRef,
			cellOptionPaletteRef,
			resolvedOpenCellPickerRefInternal,
			resolvedOpenLayoutEditorRefInternal,
			defaultStateRef,
		]
	);

	useImperativeHandle(handleRef, () => handle, [handle]);

	useEffect(() => {
		const cleanup = onReady?.(handle);
		return () => {
			cleanup?.();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [handle]);

	const commandsPlugin = commands?.plugin;
	const commandsId = commands?.id;
	const commandsLabel = commands?.label;
	useEffect(() => {
		if (!commandsPlugin || !commandsId || !commandsLabel) return;
		registerGridCommands(commandsPlugin, commandsId, commandsLabel, handle);
	}, [commandsPlugin, commandsId, commandsLabel, handle]);

	useEffect(() => {
		injectGridStyles(cssPrefix);
	}, [cssPrefix]);

	// ─── Render ──────────────────────────────────────────────────────────────
	const css = useMemo(() => createCssUtils(cssPrefix), [cssPrefix]);
	const gridElRef = useRef<HTMLDivElement>(null);
	const rowContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
	const colContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

	const perCellMode: PerCellAxis | null =
		resizable === "cell-width" ? "row" : resizable === "cell-height" ? "col" : null;
	const trackMode = resizable === "track";
	const isResizable = resizable !== undefined;
	const showTrackHandles = isResizable && !minCellWidth;

	const { cols, rows: stateRows, placements, ghostKeys, columnSizes, rowSizes, cellColumnSizes, cellRowSizes } = state;
	const gridStyle = buildGridStyleVars(cols, stateRows, columnSizes, rowSizes, gap, minCellWidth, resizable);

	const hasPalette = palette.pickerEntries.length > 0;
	const showEditButton = editable === true && hasPalette && resolvedOpenLayoutEditor !== undefined;

	const perCellCount = perCellMode === "row" ? stateRows : perCellMode === "col" ? cols : 0;
	const { containers: containerPlacements, orphans: directPlacements } = perCellMode
		? bucketPlacementsByAxis(placements, perCellMode, perCellCount)
		: { containers: [], orphans: [...placements] };

	// No enlarge modal — consumers render React content; if they want an enlarge
	// view they can render a button inside the <Cell> that opens their own modal.
	const onOpenEnlarge: ((placement: Placement) => void) | undefined = undefined;

	const colHandleCount = trackMode ? (columnSizes?.length ?? cols) - 1 : resizable === "cell-height" ? cols - 1 : 0;
	const rowHandleCount = trackMode
		? (rowSizes?.length ?? stateRows) - 1
		: resizable === "cell-width"
			? stateRows - 1
			: 0;

	const commitColumnSizes = useCallback(
		(sizes: number[]) => dispatch({ type: "commitColumnSizes", sizes }),
		[dispatch]
	);
	const commitRowSizes = useCallback((sizes: number[]) => dispatch({ type: "commitRowSizes", sizes }), [dispatch]);
	const showPicker = useCallback((row: number, col: number) => handle.showCellPicker(row, col), [handle]);

	const cellStyle: GridCellStyle = { css, cssPrefix };
	const hasPicker = hasPalette && resolvedOpenCellPicker !== undefined;
	const cellController: GridCellController = { onOpenEnlarge, onShowPicker: showPicker, registerElement };

	const mergedClassName = consumerClassName ? `${css.cls("grid")} ${consumerClassName}` : css.cls("grid");
	const mergedStyle = consumerStyle ? { ...consumerStyle, ...gridStyle } : gridStyle;

	return (
		<div className={mergedClassName} style={mergedStyle} ref={gridElRef} {...rest}>
			{perCellMode &&
				containerPlacements.map((axisPlacements, idx) => {
					const innerCount = perCellMode === "row" ? cols : stateRows;
					const innerSizes = perCellMode === "row" ? cellColumnSizes?.[String(idx)] : cellRowSizes?.[String(idx)];
					const commitInner = (sizes: number[]): void => {
						if (perCellMode === "row") dispatch({ type: "commitCellColumnSizes", rowIdx: idx, sizes });
						else dispatch({ type: "commitCellRowSizes", colIdx: idx, sizes });
					};
					const containerRefs = perCellMode === "row" ? rowContainerRefs : colContainerRefs;
					return (
						<PerCellContainer
							key={`${PER_CELL_AXIS_CONFIG[perCellMode].keyPrefix}${idx}`}
							model={{
								axis: perCellMode,
								placements: axisPlacements,
								palette,
								innerCount,
								innerSizes,
								gap,
								dividers: dividers === true,
								hasPalette,
								hasPicker,
							}}
							controller={{
								...cellController,
								setContainerEl: (el) => {
									containerRefs.current[idx] = el;
								},
								getContainerEl: () => containerRefs.current[idx],
								onCommitInner: commitInner,
							}}
							style={cellStyle}
						/>
					);
				})}

			{!perCellMode &&
				directPlacements.map((placement) => (
					<GridCellView
						key={placement.instanceId}
						model={{ placement, palette, dividers: dividers === true, hasPalette, hasPicker, perCell: false }}
						controller={cellController}
						style={cellStyle}
					/>
				))}
			{!perCellMode &&
				Array.from(ghostKeys).map((key) => {
					const [r, c] = key.split(":").map(Number);
					return <GhostCell key={`ghost-${r}-${c}`} cssPrefix={cssPrefix} row={r} col={c} />;
				})}

			{showEditButton && <EditButton cssPrefix={cssPrefix} onClick={() => handle.showLayoutEditor()} />}

			{showTrackHandles && colHandleCount > 0 && (
				<GridResizeHandles
					cssPrefix={cssPrefix}
					getContainer={() => gridElRef.current}
					axis="col"
					count={colHandleCount}
					getSizes={() => syncStateRef.current.columnSizes ?? defaultSizes(cols)}
					onSizesChange={commitColumnSizes}
				/>
			)}
			{showTrackHandles && rowHandleCount > 0 && (
				<GridResizeHandles
					cssPrefix={cssPrefix}
					getContainer={() => gridElRef.current}
					axis="row"
					count={rowHandleCount}
					getSizes={() => syncStateRef.current.rowSizes ?? defaultSizes(stateRows)}
					onSizesChange={commitRowSizes}
				/>
			)}
		</div>
	);
});
