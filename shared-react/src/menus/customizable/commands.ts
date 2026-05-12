import type { Plugin } from "obsidian";

import type { CustomizableContextMenuHandle } from "./types";

/**
 * Registers an Obsidian command that opens the item manager modal for a given
 * customizable context menu handle. Mirrors the command surface of the legacy
 * imperative module so plugins continue exposing a "Manage menu items" hotkey.
 */
export function registerCustomizableContextMenuCommand(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: CustomizableContextMenuHandle
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
