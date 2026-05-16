import type { GridLayoutConfig, GridLayoutHandle } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { openCellPicker } from "./cell-picker-modal";
import { createGridLayoutCore } from "./engine-core";
import { GridEngineView } from "./engine";
import { openLayoutEditor } from "./layout-editor-modal";

export interface ReactGridLayoutConfig extends GridLayoutConfig {
	app?: App;
}

function withModalDefaults(config: ReactGridLayoutConfig): ReactGridLayoutConfig {
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

	return {
		...config,
		...(onOpenLayoutEditor ? { onOpenLayoutEditor } : {}),
		...(onOpenCellPicker ? { onOpenCellPicker } : {}),
	};
}

export function createGridLayout(container: HTMLElement, config: ReactGridLayoutConfig): GridLayoutHandle {
	const resolved = withModalDefaults(config);
	const core = createGridLayoutCore(resolved, { flush: flushSync });
	const root: Root = createRoot(container);
	flushSync(() => {
		root.render(createElement(GridEngineView, { core }));
	});

	const innerDestroy = core.handle.destroy.bind(core.handle);
	core.handle.destroy = (): void => {
		innerDestroy();
		flushSync(() => root.unmount());
	};

	return core.handle;
}
