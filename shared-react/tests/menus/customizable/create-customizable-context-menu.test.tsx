import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { createCustomizableContextMenu } from "../../../src/menus/customizable/create-customizable-context-menu";
import type { CustomizableContextMenuItem } from "../../../src/menus/customizable/types";

const PREFIX = "test-";
const FAKE_APP = {} as unknown as App;

function items(): CustomizableContextMenuItem[] {
	return [
		{ id: "edit", label: "Edit", icon: "pencil", section: "edit", onAction: vi.fn() },
		{ id: "delete", label: "Delete", icon: "trash", section: "danger", onAction: vi.fn() },
	];
}

describe("createCustomizableContextMenu", () => {
	it("returns a handle exposing the imperative API surface", () => {
		const handle = createCustomizableContextMenu({ app: FAKE_APP, items: items(), cssPrefix: PREFIX });

		expect(typeof handle.show).toBe("function");
		expect(typeof handle.hideItem).toBe("function");
		expect(typeof handle.restoreItem).toBe("function");
		expect(typeof handle.moveItem).toBe("function");
		expect(typeof handle.showItemManager).toBe("function");
		expect(typeof handle.getState).toBe("function");
		expect(typeof handle.destroy).toBe("function");
		expect(handle.visibleCount).toBe(2);

		handle.destroy();
	});

	it("show() with a position does not throw (Obsidian Menu renders natively)", () => {
		const handle = createCustomizableContextMenu({ app: FAKE_APP, items: items(), cssPrefix: PREFIX });
		expect(() => handle.show({ x: 10, y: 20 })).not.toThrow();
		handle.destroy();
	});

	it("show() with a MouseEvent does not throw", () => {
		const handle = createCustomizableContextMenu({ app: FAKE_APP, items: items(), cssPrefix: PREFIX });
		expect(() => handle.show(new MouseEvent("contextmenu", { clientX: 42, clientY: 84 }))).not.toThrow();
		handle.destroy();
	});

	it("emits onStateChange for hideItem and restoreItem", () => {
		const onStateChange = vi.fn();
		const handle = createCustomizableContextMenu({
			app: FAKE_APP,
			items: items(),
			cssPrefix: PREFIX,
			onStateChange,
		});

		handle.hideItem("edit");
		expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ visibleItemIds: ["delete"] }));

		handle.restoreItem("edit");
		expect(onStateChange).toHaveBeenCalledTimes(2);

		handle.destroy();
	});

	it("emits onStateChange for moveItem", () => {
		const onStateChange = vi.fn();
		const handle = createCustomizableContextMenu({
			app: FAKE_APP,
			items: items(),
			cssPrefix: PREFIX,
			onStateChange,
		});

		// Both items are in different sections — moving within a section requires
		// at least two items there; this confirms a no-op doesn't emit a change.
		handle.moveItem("edit", 1);
		expect(onStateChange).not.toHaveBeenCalled();

		handle.destroy();
	});

	it("getState reflects mutations through the imperative API", () => {
		const handle = createCustomizableContextMenu({ app: FAKE_APP, items: items(), cssPrefix: PREFIX });

		handle.hideItem("edit");
		expect(handle.getState().visibleItemIds).toEqual(["delete"]);

		handle.restoreItem("edit");
		// Restoring puts the item back at the end of its original section, so the
		// edit-section item ends up after the danger-section item.
		expect(handle.getState().visibleItemIds).toEqual(["delete", "edit"]);

		handle.destroy();
	});

	it("mutations after destroy are no-ops", () => {
		const onStateChange = vi.fn();
		const handle = createCustomizableContextMenu({
			app: FAKE_APP,
			items: items(),
			cssPrefix: PREFIX,
			onStateChange,
		});

		handle.destroy();
		handle.hideItem("edit");
		handle.restoreItem("edit");
		handle.moveItem("edit", 1);

		expect(onStateChange).not.toHaveBeenCalled();
		expect(() => handle.show({ x: 0, y: 0 })).not.toThrow();
	});
});
