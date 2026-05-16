import type { Plugin } from "obsidian";

import type { GridLayoutHandle } from "./types";

export function registerGridCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: GridLayoutHandle
): void {
	plugin.addCommand({
		id: `${commandPrefix}:edit-layout`,
		name: `${displayName}: Edit layout`,
		checkCallback: (checking) => {
			if (handle.columns === 0) return false;
			if (!checking) handle.showLayoutEditor();
			return true;
		},
	});

	for (let r = 0; r < handle.rows; r++) {
		for (let c = 0; c < handle.columns; c++) {
			const row = r;
			const col = c;
			plugin.addCommand({
				id: `${commandPrefix}:swap-cell-${row + 1}-${col + 1}`,
				name: `${displayName}: Swap cell (${row + 1}, ${col + 1})`,
				checkCallback: (checking) => {
					if (handle.columns === 0) return false;
					if (!checking) handle.showCellPicker(row, col);
					return true;
				},
			});
		}
	}
}
