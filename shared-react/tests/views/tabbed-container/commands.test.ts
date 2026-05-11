import type { Command, Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { registerTabCommands } from "../../../src/views/tabbed-container/commands";
import type { TabbedContainerHandle } from "../../../src/views/tabbed-container/types";

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
		...overrides,
	};
}

interface MockPlugin extends Pick<Plugin, "addCommand"> {
	commands: Command[];
}

function makePlugin(): MockPlugin {
	const commands: Command[] = [];
	return {
		commands,
		addCommand: vi.fn((cmd: Command) => {
			commands.push(cmd);
			return cmd;
		}),
	};
}

describe("registerTabCommands", () => {
	it("registers manage + next + previous + N go-to commands", () => {
		const plugin = makePlugin();
		const handle = makeHandle();

		registerTabCommands(plugin as unknown as Plugin, "my-view", "My View", () => handle, ["A", "B", "C"]);
		expect(plugin.addCommand).toHaveBeenCalledTimes(6);
	});

	it("uses the resolveHandle thunk on each invocation (handle may change across renders)", () => {
		const plugin = makePlugin();
		let current: TabbedContainerHandle | null = makeHandle();

		registerTabCommands(plugin as unknown as Plugin, "p", "P", () => current, ["A"]);
		const next = plugin.commands.find((c) => c.id === "p:next-tab")!;

		next.checkCallback?.(false);
		expect(current?.next).toHaveBeenCalledTimes(1);

		// Replace the handle — next invocation should call the new instance.
		const replaced = makeHandle();
		current = replaced;
		next.checkCallback?.(false);
		expect(replaced.next).toHaveBeenCalledTimes(1);
	});

	it("returns false when the resolved handle is null", () => {
		const plugin = makePlugin();
		registerTabCommands(plugin as unknown as Plugin, "p", "P", () => null, ["A"]);

		const next = plugin.commands.find((c) => c.id === "p:next-tab")!;
		expect(next.checkCallback?.(true)).toBe(false);
	});

	it("returns false when tabCount is 0", () => {
		const plugin = makePlugin();
		const handle = makeHandle({ tabCount: 0 });
		registerTabCommands(plugin as unknown as Plugin, "p", "P", () => handle, ["A"]);

		const next = plugin.commands.find((c) => c.id === "p:next-tab")!;
		expect(next.checkCallback?.(true)).toBe(false);
		expect(handle.next).not.toHaveBeenCalled();
	});

	it("checking mode returns true without executing the action", () => {
		const plugin = makePlugin();
		const handle = makeHandle();
		registerTabCommands(plugin as unknown as Plugin, "p", "P", () => handle, ["A"]);

		const next = plugin.commands.find((c) => c.id === "p:next-tab")!;
		expect(next.checkCallback?.(true)).toBe(true);
		expect(handle.next).not.toHaveBeenCalled();
	});

	it("manage-tabs invokes showTabManager", () => {
		const plugin = makePlugin();
		const handle = makeHandle();
		registerTabCommands(plugin as unknown as Plugin, "p", "P", () => handle, []);

		const manage = plugin.commands.find((c) => c.id === "p:manage-tabs")!;
		manage.checkCallback?.(false);
		expect(handle.showTabManager).toHaveBeenCalledOnce();
	});

	it("go-to-tab-N calls switchTo with the right index", () => {
		const plugin = makePlugin();
		const handle = makeHandle();
		registerTabCommands(plugin as unknown as Plugin, "p", "P", () => handle, ["A", "B"]);

		const goTo2 = plugin.commands.find((c) => c.id === "p:go-to-tab-2")!;
		goTo2.checkCallback?.(false);
		expect(handle.switchTo).toHaveBeenCalledWith(1);
	});

	it("updateLabels rewrites go-to-tab command names", () => {
		const plugin = makePlugin();
		const handle = makeHandle();
		const { updateLabels } = registerTabCommands(plugin as unknown as Plugin, "v", "V", () => handle, [
			"Calendar",
			"Timeline",
		]);

		const goTo1 = plugin.commands.find((c) => c.id === "v:go-to-tab-1")!;
		updateLabels(["Heatmap", "Calendar"]);
		expect(goTo1.name).toBe("V: Go to tab 1: Heatmap");
	});

	it("updateLabels falls back to 'Tab N' when fewer labels are provided", () => {
		const plugin = makePlugin();
		const handle = makeHandle();
		const { updateLabels } = registerTabCommands(plugin as unknown as Plugin, "v", "V", () => handle, ["A", "B"]);

		updateLabels(["Renamed"]);
		const goTo2 = plugin.commands.find((c) => c.id === "v:go-to-tab-2")!;
		expect(goTo2.name).toBe("V: Go to tab 2: Tab 2");
	});
});
