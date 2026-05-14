import { type GridLayoutHandle, registerGridCommands } from "@real1ty-obsidian-plugins";
import type { Plugin } from "obsidian";
import { type HTMLAttributes, memo, useEffect, useRef } from "react";

import { createGridLayout, type ReactGridLayoutConfig } from "./create-grid-layout";

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
	const containerRef = useRef<HTMLDivElement>(null);
	const onReadyRef = useRef(onReady);
	const onStateChangeRef = useRef(onStateChange);
	const onCellChangeRef = useRef(onCellChange);
	onReadyRef.current = onReady;
	onStateChangeRef.current = onStateChange;
	onCellChangeRef.current = onCellChange;

	const commandsPlugin = commands?.plugin;
	const commandsId = commands?.id;
	const commandsLabel = commands?.label;

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const handle = createGridLayout(el, {
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
			...(onOpenLayoutEditor !== undefined ? { onOpenLayoutEditor } : {}),
			...(onOpenCellPicker !== undefined ? { onOpenCellPicker } : {}),
			onStateChange: (state) => {
				onStateChangeRef.current?.(state);
			},
			onCellChange: (row, col, id) => {
				onCellChangeRef.current?.(row, col, id);
			},
		});

		if (commandsPlugin && commandsId && commandsLabel) {
			registerGridCommands(commandsPlugin, commandsId, commandsLabel, handle);
		}

		const customCleanup = onReadyRef.current?.(handle);

		return () => {
			customCleanup?.();
			handle.destroy();
		};
	}, [
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
		onOpenLayoutEditor,
		onOpenCellPicker,
		commandsPlugin,
		commandsId,
		commandsLabel,
	]);

	return <div ref={containerRef} {...rest} />;
});
