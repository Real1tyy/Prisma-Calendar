import type { Plugin } from "obsidian";

import type { ContextMenuHandle } from "./types";

export function registerContextMenuCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: ContextMenuHandle
): void {
	plugin.addCommand({
		id: `${commandPrefix}:manage-context-menu`,
		name: `${displayName}: Manage context menu items`,
		checkCallback: (checking) => {
			if (handle.visibleCount === 0) return false;
			if (!checking) handle.showItemManager();
			return true;
		},
	});
}
