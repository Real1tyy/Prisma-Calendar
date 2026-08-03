import type { Setting, SettingGroup } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { reactSettingDefinitions } from "../src/react-settings-definitions";

function renderRow(definitions: ReturnType<typeof reactSettingDefinitions>) {
	const listEl = document.createElement("div");
	const settingEl = listEl.appendChild(document.createElement("div"));
	const definition = definitions[0];
	if (!("render" in definition) || !definition.render) throw new Error("expected a render definition");

	const cleanup = definition.render({ settingEl } as Setting, { listEl } as SettingGroup);
	return { listEl, settingEl, cleanup };
}

describe("reactSettingDefinitions", () => {
	it("declares a single unsearchable entry under the given name", () => {
		const definitions = reactSettingDefinitions("Prisma Calendar", () => () => {});

		expect(definitions).toHaveLength(1);
		expect(definitions[0].name).toBe("Prisma Calendar");
		// An opaque row carries no per-setting text, so indexing it would put a
		// single unactionable hit in Obsidian's settings search.
		expect(definitions[0].searchable).toBe(false);
	});

	it("mounts into the group's list rather than the placeholder row", () => {
		const mount = vi.fn(() => () => {});
		const { listEl, settingEl } = renderRow(reactSettingDefinitions("Plugin", mount));

		expect(settingEl.isConnected).toBe(false);
		expect(mount).toHaveBeenCalledTimes(1);
		const host = mount.mock.calls[0][0] as HTMLElement;
		expect(host.parentElement).toBe(listEl);
	});

	it("returns the unmount function as the row's cleanup", () => {
		const unmount = vi.fn();
		const { cleanup } = renderRow(reactSettingDefinitions("Plugin", () => unmount));

		expect(unmount).not.toHaveBeenCalled();
		cleanup?.();
		expect(unmount).toHaveBeenCalledTimes(1);
	});
});
