import { describe, expect, it, vi } from "vitest";

import { registerTabCommands } from "../../src/components/tabbed-container/commands";
import type { TabbedContainerHandle } from "../../src/components/tabbed-container/types";

function makeHandle(overrides?: Partial<TabbedContainerHandle>): TabbedContainerHandle {
	return {
		switchTo: vi.fn(),
		next: vi.fn(),
		previous: vi.fn(),
		hideTab: vi.fn(),
		restoreTab: vi.fn(),
		moveTab: vi.fn(),
		showTabManager: vi.fn(),
		getState: vi.fn().mockReturnValue({}),
		getVisibleLabels: vi.fn().mockReturnValue([]),
		activeIndex: 0,
		activeId: "tab-0",
		tabCount: 3,
		destroy: vi.fn(),
		...overrides,
	};
}

function makePlugin(): { addCommand: ReturnType<typeof vi.fn>; commands: any[] } {
	const commands: any[] = [];
	return {
		commands,
		addCommand: vi.fn((cmd: any) => {
			commands.push(cmd);
			return cmd;
		}),
	};
}

describe("registerTabCommands", () => {
	it("registers N+3 commands (manage, next, previous, go-to-tab-1..N)", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "my-view", "My View", handle, ["Overview", "Details", "Stats"]);

		expect(plugin.addCommand).toHaveBeenCalledTimes(6);
	});

	it("registers manage-tabs command", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "my-view", "My View", handle, ["A"]);

		const manageCmd = plugin.commands.find((c: any) => c.id === "my-view:manage-tabs");
		expect(manageCmd).toBeTruthy();
		expect(manageCmd.name).toBe("My View: Manage tabs");
	});

	it("registers next-tab command with correct id and name", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "my-view", "My View", handle, ["A", "B"]);

		const nextCmd = plugin.commands.find((c: any) => c.id === "my-view:next-tab");
		expect(nextCmd).toBeTruthy();
		expect(nextCmd.name).toBe("My View: Next tab");
	});

	it("registers previous-tab command with correct id and name", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "my-view", "My View", handle, ["A", "B"]);

		const prevCmd = plugin.commands.find((c: any) => c.id === "my-view:previous-tab");
		expect(prevCmd).toBeTruthy();
		expect(prevCmd.name).toBe("My View: Previous tab");
	});

	it("registers go-to-tab commands for each tab", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "my-view", "My View", handle, ["Overview", "Details"]);

		const goTo1 = plugin.commands.find((c: any) => c.id === "my-view:go-to-tab-1");
		expect(goTo1).toBeTruthy();
		expect(goTo1.name).toBe("My View: Go to tab 1: Overview");

		const goTo2 = plugin.commands.find((c: any) => c.id === "my-view:go-to-tab-2");
		expect(goTo2).toBeTruthy();
		expect(goTo2.name).toBe("My View: Go to tab 2: Details");
	});

	it("next-tab command calls handle.next()", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "p", "P", handle, ["A"]);

		const nextCmd = plugin.commands.find((c: any) => c.id === "p:next-tab");
		const result = nextCmd.checkCallback(false);
		expect(result).toBe(true);
		expect(handle.next).toHaveBeenCalledOnce();
	});

	it("previous-tab command calls handle.previous()", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "p", "P", handle, ["A"]);

		const prevCmd = plugin.commands.find((c: any) => c.id === "p:previous-tab");
		const result = prevCmd.checkCallback(false);
		expect(result).toBe(true);
		expect(handle.previous).toHaveBeenCalledOnce();
	});

	it("go-to-tab command calls handle.switchTo with correct index", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "p", "P", handle, ["A", "B"]);

		const goTo2 = plugin.commands.find((c: any) => c.id === "p:go-to-tab-2");
		goTo2.checkCallback(false);
		expect(handle.switchTo).toHaveBeenCalledWith(1);
	});

	it("checkCallback returns false when tabCount is 0", () => {
		const plugin = makePlugin();
		const handle = makeHandle({ tabCount: 0 });

		registerTabCommands(plugin as any, "p", "P", handle, ["A"]);

		const nextCmd = plugin.commands.find((c: any) => c.id === "p:next-tab");
		expect(nextCmd.checkCallback(true)).toBe(false);
		expect(handle.next).not.toHaveBeenCalled();
	});

	it("checkCallback in checking mode does not execute", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as any, "p", "P", handle, ["A"]);

		const nextCmd = plugin.commands.find((c: any) => c.id === "p:next-tab");
		expect(nextCmd.checkCallback(true)).toBe(true);
		expect(handle.next).not.toHaveBeenCalled();
	});

	it("updateLabels refreshes go-to-tab command names", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		const { updateLabels } = registerTabCommands(plugin as any, "my-view", "My View", handle, ["Calendar", "Timeline"]);

		const goTo1 = plugin.commands.find((c: any) => c.id === "my-view:go-to-tab-1");
		const goTo2 = plugin.commands.find((c: any) => c.id === "my-view:go-to-tab-2");

		updateLabels(["Heatmap", "Calendar"]);

		expect(goTo1.name).toBe("My View: Go to tab 1: Heatmap");
		expect(goTo2.name).toBe("My View: Go to tab 2: Calendar");
	});
});
