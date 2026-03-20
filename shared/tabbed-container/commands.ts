import type { Plugin } from "obsidian";

import type { TabbedContainerHandle } from "./types";

export function registerTabCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: TabbedContainerHandle,
	tabLabels: string[]
): void {
	const addTabCommand = (idSuffix: string, name: string, action: () => void): void => {
		plugin.addCommand({
			id: `${commandPrefix}:${idSuffix}`,
			name: `${displayName}: ${name}`,
			checkCallback: (checking) => {
				if (handle.tabCount === 0) return false;
				if (!checking) action();
				return true;
			},
		});
	};

	addTabCommand("manage-tabs", "Manage tabs", () => handle.showTabManager());
	addTabCommand("next-tab", "Next tab", () => handle.next());
	addTabCommand("previous-tab", "Previous tab", () => handle.previous());

	for (let i = 0; i < tabLabels.length; i++) {
		const index = i;
		addTabCommand(`go-to-tab-${index + 1}`, `Go to tab ${index + 1}: ${tabLabels[index]}`, () =>
			handle.switchTo(index)
		);
	}
}
