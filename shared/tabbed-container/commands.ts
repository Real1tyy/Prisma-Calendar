import type { Plugin } from "obsidian";

import type { TabbedContainerHandle } from "./types";

export function registerTabCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: TabbedContainerHandle,
	tabLabels: string[]
): void {
	plugin.addCommand({
		id: `${commandPrefix}:manage-tabs`,
		name: `${displayName}: Manage tabs`,
		checkCallback: (checking) => {
			if (handle.tabCount === 0) return false;
			if (!checking) handle.showTabManager();
			return true;
		},
	});

	plugin.addCommand({
		id: `${commandPrefix}:next-tab`,
		name: `${displayName}: Next tab`,
		checkCallback: (checking) => {
			if (handle.tabCount === 0) return false;
			if (!checking) handle.next();
			return true;
		},
	});

	plugin.addCommand({
		id: `${commandPrefix}:previous-tab`,
		name: `${displayName}: Previous tab`,
		checkCallback: (checking) => {
			if (handle.tabCount === 0) return false;
			if (!checking) handle.previous();
			return true;
		},
	});

	for (let i = 0; i < tabLabels.length; i++) {
		const index = i;
		plugin.addCommand({
			id: `${commandPrefix}:go-to-tab-${index + 1}`,
			name: `${displayName}: Go to tab ${index + 1}: ${tabLabels[index]}`,
			checkCallback: (checking) => {
				if (handle.tabCount === 0) return false;
				if (!checking) handle.switchTo(index);
				return true;
			},
		});
	}
}
