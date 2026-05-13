import type { App } from "obsidian";

interface AppCommands {
	executeCommandById: (id: string) => boolean;
	commands: Record<string, unknown>;
}

function getCommands(app: App): AppCommands {
	return (app as App & { commands: AppCommands }).commands;
}

export function executeCommand(app: App, commandId: string): boolean {
	return getCommands(app).executeCommandById(commandId);
}

export function hasCommand(app: App, commandId: string): boolean {
	return commandId in getCommands(app).commands;
}
