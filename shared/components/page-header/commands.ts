import type { Plugin } from "obsidian";

import type { PageHeaderHandle } from "./types";

export function registerPageHeaderCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: PageHeaderHandle
): void {
	plugin.addCommand({
		id: `${commandPrefix}:manage-header-actions`,
		name: `${displayName}: Manage header actions`,
		checkCallback: (checking) => {
			if (handle.visibleCount === 0) return false;
			if (!checking) handle.showActionManager();
			return true;
		},
	});
}
