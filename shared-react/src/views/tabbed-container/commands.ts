import type { Command, Plugin } from "obsidian";

import type { TabbedContainerHandle } from "./types";

export interface TabCommandUpdater {
	updateLabels: (labels: string[]) => void;
}

/**
 * Registers Obsidian commands for tab navigation: manage tabs, next/previous,
 * and one "Go to tab N: <label>" command per visible tab. The handle parameter
 * is read each time a command runs, so resolves correctly across React re-renders
 * (callers should pass a stable reference — typically a ref's `.current`).
 */
export function registerTabCommands(
	plugin: Plugin,
	commandPrefix: string,
	displayName: string,
	resolveHandle: () => TabbedContainerHandle | null,
	tabLabels: string[]
): TabCommandUpdater {
	const tabCommands: Command[] = [];

	const addTabCommand = (idSuffix: string, name: string, action: (handle: TabbedContainerHandle) => void): Command => {
		return plugin.addCommand({
			id: `${commandPrefix}:${idSuffix}`,
			name: `${displayName}: ${name}`,
			checkCallback: (checking) => {
				const handle = resolveHandle();
				if (!handle || handle.tabCount === 0) return false;
				if (!checking) action(handle);
				return true;
			},
		});
	};

	addTabCommand("manage-tabs", "Manage tabs", (h) => h.showTabManager());
	addTabCommand("next-tab", "Next tab", (h) => h.next());
	addTabCommand("previous-tab", "Previous tab", (h) => h.previous());

	for (let i = 0; i < tabLabels.length; i++) {
		const index = i;
		const cmd = addTabCommand(`go-to-tab-${index + 1}`, `Go to tab ${index + 1}: ${tabLabels[index]}`, (h) =>
			h.switchTo(index)
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
