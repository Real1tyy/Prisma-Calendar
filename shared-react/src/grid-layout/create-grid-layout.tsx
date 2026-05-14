import {
	createGridLayout as createImperativeGridLayout,
	type GridLayoutConfig,
	type GridLayoutHandle,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { openCellPicker } from "./cell-picker-modal";
import { openLayoutEditor } from "./layout-editor-modal";

export interface ReactGridLayoutConfig extends GridLayoutConfig {
	app?: App;
}

/**
 * Wrapper around the imperative `createGridLayout` that auto-wires the
 * `onOpenLayoutEditor` / `onOpenCellPicker` callbacks to the React modal
 * openers in this package. Consumers that prefer custom modal handling can
 * pass their own callbacks — explicit values win over the defaults.
 *
 * `app` is required only when the grid uses `editable` or `cellPalette` modals.
 * Pure-layout grids can omit it.
 */
export function createGridLayout(container: HTMLElement, config: ReactGridLayoutConfig): GridLayoutHandle {
	const { app, cssPrefix } = config;

	const defaultOpenLayoutEditor: GridLayoutConfig["onOpenLayoutEditor"] | undefined = app
		? (currentState, cellPalette, applyState) => {
				openLayoutEditor(app, { cssPrefix, initialState: currentState, cellPalette, onApply: applyState });
			}
		: undefined;

	const defaultOpenCellPicker: GridLayoutConfig["onOpenCellPicker"] | undefined = app
		? (row, col, currentId, usedIds, cellPalette, selectOption) => {
				openCellPicker(app, {
					cssPrefix,
					row,
					col,
					cellPalette,
					currentId,
					usedIds,
					onSelect: (optionId) => {
						const option = cellPalette.find((o) => o.id === optionId);
						if (option) selectOption(option);
					},
				});
			}
		: undefined;

	const onOpenLayoutEditor = config.onOpenLayoutEditor ?? defaultOpenLayoutEditor;
	const onOpenCellPicker = config.onOpenCellPicker ?? defaultOpenCellPicker;

	return createImperativeGridLayout(container, {
		...config,
		...(onOpenLayoutEditor ? { onOpenLayoutEditor } : {}),
		...(onOpenCellPicker ? { onOpenCellPicker } : {}),
	});
}
