import type { Command, Plugin } from "obsidian";

import type { TabbedContainerHandle } from "./types";

export function registerTabCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	handle: TabbedContainerHandle,
	tabLabels: string[]
): { updateLabels: (labels: string[]) => void } {
	const tabCommands: Command[] = [];

	const addTabCommand = (idSuffix: string, name: string, action: () => void): Command => {
		return plugin.addCommand({
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
		const cmd = addTabCommand(`go-to-tab-${index + 1}`, `Go to tab ${index + 1}: ${tabLabels[index]}`, () =>
			handle.switchTo(index)
		);
		tabCommands.push(cmd);
	}

	return {
		updateLabels(labels: string[]): void {
			for (let i = 0; i < tabCommands.length; i++) {
				const label = i < labels.length ? labels[i] : `Tab ${i + 1}`;
				tabCommands[i].name = `${displayName}: Go to tab ${i + 1}: ${label}`;
			}
		},
	};
}
