import type { Plugin } from "obsidian";
import { type HTMLAttributes, memo, useEffect, useMemo, useRef } from "react";

import { openCellPicker } from "./cell-picker-modal";
import { registerGridCommands } from "./commands";
import type { ReactGridLayoutConfig } from "./create-grid-layout";
import { createGridLayoutCore } from "./engine-core";
import { GridEngineView } from "./engine";
import { openLayoutEditor } from "./layout-editor-modal";
import type { GridLayoutConfig, GridLayoutHandle } from "./types";

export interface GridLayoutCommandsConfig {
	plugin: Plugin;
	id: string;
	label: string;
}

type DivAttributes = Omit<HTMLAttributes<HTMLDivElement>, keyof ReactGridLayoutConfig | "children">;

export interface GridLayoutProps extends ReactGridLayoutConfig, DivAttributes {
	commands?: GridLayoutCommandsConfig;
	onReady?: (handle: GridLayoutHandle) => (() => void) | void;
}

export const GridLayout = memo(function GridLayout({
	commands,
	onReady,
	app,
	cssPrefix,
	columns,
	rows,
	cells,
	gap,
	minCellWidth,
	dividers,
	editable,
	resizable,
	cellPalette,
	initialState,
	onCellChange,
	onStateChange,
	onOpenLayoutEditor,
	onOpenCellPicker,
	...rest
}: GridLayoutProps) {
	const onReadyRef = useRef(onReady);
	const onStateChangeRef = useRef(onStateChange);
	const onCellChangeRef = useRef(onCellChange);
	const onOpenLayoutEditorRef = useRef(onOpenLayoutEditor);
	const onOpenCellPickerRef = useRef(onOpenCellPicker);
	onReadyRef.current = onReady;
	onStateChangeRef.current = onStateChange;
	onCellChangeRef.current = onCellChange;
	onOpenLayoutEditorRef.current = onOpenLayoutEditor;
	onOpenCellPickerRef.current = onOpenCellPicker;

	// Engine is durable for the component's lifetime. cssPrefix and initial structural
	// props (initialState, columns, rows, cells) are read once at construction. To
	// rebuild for a wholesale reset, the consumer passes a different `key` to <GridLayout>.
	const core = useMemo(() => {
		const defaultOpenLayoutEditor: GridLayoutConfig["onOpenLayoutEditor"] | undefined = app
			? (currentState, palette, applyState) => {
					openLayoutEditor(app, {
						cssPrefix,
						initialState: currentState,
						cellPalette: palette,
						onApply: applyState,
					});
				}
			: undefined;

		const defaultOpenCellPicker: GridLayoutConfig["onOpenCellPicker"] | undefined = app
			? (row, col, currentId, usedIds, palette, selectOption) => {
					openCellPicker(app, {
						cssPrefix,
						row,
						col,
						cellPalette: palette,
						currentId,
						usedIds,
						onSelect: (optionId) => {
							const option = palette.find((o) => o.id === optionId);
							if (option) selectOption(option);
						},
					});
				}
			: undefined;

		const resolvedOpenLayoutEditor = onOpenLayoutEditorRef.current ?? defaultOpenLayoutEditor;
		const resolvedOpenCellPicker = onOpenCellPickerRef.current ?? defaultOpenCellPicker;

		const config: GridLayoutConfig = {
			cssPrefix,
			columns,
			rows,
			...(app !== undefined ? { app } : {}),
			...(cells !== undefined ? { cells } : {}),
			...(gap !== undefined ? { gap } : {}),
			...(minCellWidth !== undefined ? { minCellWidth } : {}),
			...(dividers !== undefined ? { dividers } : {}),
			...(editable !== undefined ? { editable } : {}),
			...(resizable !== undefined ? { resizable } : {}),
			...(cellPalette !== undefined ? { cellPalette } : {}),
			...(initialState !== undefined ? { initialState } : {}),
			...(resolvedOpenLayoutEditor ? { onOpenLayoutEditor: resolvedOpenLayoutEditor } : {}),
			...(resolvedOpenCellPicker ? { onOpenCellPicker: resolvedOpenCellPicker } : {}),
			onStateChange: (state) => onStateChangeRef.current?.(state),
			onCellChange: (row, col, id) => onCellChangeRef.current?.(row, col, id),
		};

		// No flush override — React's useSyncExternalStore schedules re-renders normally.
		// Using flushSync here would crash when notify() fires from inside React's commit
		// phase (e.g., during the destroy effect cleanup that calls handle.destroy() →
		// notify() to set destroyed=true).
		return createGridLayoutCore(config);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- engine is durable across re-renders; force rebuild via `key` prop
	}, []);

	// Apply runtime cell updates: re-installs render/cleanup closures so cell contents
	// pick up parent prop/state changes without tearing the engine down. The engine was
	// constructed with the initial cells, so we skip the first effect run.
	const isFirstCellsEffect = useRef(true);
	useEffect(() => {
		if (isFirstCellsEffect.current) {
			isFirstCellsEffect.current = false;
			return;
		}
		if (!cells) return;
		for (const cell of cells) {
			if (!cell.id) continue;
			core.handle.setCellById(cell.id, cell.render, cell.cleanup);
		}
	}, [core, cells]);

	// Resize when dimensions change at runtime.
	useEffect(() => {
		if (core.handle.columns !== columns || core.handle.rows !== rows) {
			core.handle.resize(columns, rows);
		}
	}, [core, columns, rows]);

	// Wire commands once per plugin/id/label tuple.
	useEffect(() => {
		const plugin = commands?.plugin;
		const id = commands?.id;
		const label = commands?.label;
		if (!plugin || !id || !label) return;
		registerGridCommands(plugin, id, label, core.handle);
	}, [core, commands]);

	// onReady fires once with the handle; cleanup runs on unmount.
	useEffect(() => {
		const cleanup = onReadyRef.current?.(core.handle);
		return () => {
			cleanup?.();
		};
	}, [core]);

	// Destroy engine on unmount.
	useEffect(() => {
		return () => {
			core.handle.destroy();
		};
	}, [core]);

	return (
		<div {...rest}>
			<GridEngineView core={core} />
		</div>
	);
});
