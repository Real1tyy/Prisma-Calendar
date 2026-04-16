/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import type { ComponentContext, ViewComponentConfig, ViewContext } from "../../src/components/component-renderer/types";

const mockActivateView = vi.fn().mockResolvedValue(null);

vi.mock("obsidian", () => {
	class MockItemView {
		containerEl: HTMLElement;
		app: { name: string };
		leaf: any;

		constructor(leaf: any) {
			this.leaf = leaf;
			this.app = leaf.app ?? { name: "test" };
			this.containerEl = document.createElement("div");
			const header = document.createElement("div");
			const content = document.createElement("div");
			this.containerEl.appendChild(header);
			this.containerEl.appendChild(content);
		}
	}

	return { ItemView: MockItemView };
});

vi.mock("../../src/utils/activate-view", () => ({
	activateView: (...args: unknown[]) => mockActivateView(...args),
}));

const { registerComponentView } = await import("../../src/components/component-renderer/view");

describe("registerComponentView", () => {
	it("registers a view with the plugin and returns an activator", () => {
		const mockPlugin = {
			app: { workspace: { name: "workspace" } },
			registerView: vi.fn(),
		} as any;

		const config: ViewComponentConfig = {
			viewType: "test-view",
			displayText: "Test View",
			icon: "star",
			cls: "test-view-root",
			render: vi.fn(),
		};

		const activator = registerComponentView(mockPlugin, config);

		expect(mockPlugin.registerView).toHaveBeenCalledWith("test-view", expect.any(Function));
		expect(typeof activator).toBe("function");
	});

	it("activator calls activateView with the correct config", async () => {
		const mockPlugin = {
			app: { workspace: { name: "workspace" } },
			registerView: vi.fn(),
		} as any;

		const config: ViewComponentConfig = {
			viewType: "test-view",
			displayText: "Test View",
			cls: "test-cls",
			render: vi.fn(),
		};

		const activator = registerComponentView(mockPlugin, config);
		await activator("left-sidebar");

		expect(mockActivateView).toHaveBeenCalledWith(
			{ name: "workspace" },
			{
				viewType: "test-view",
				placement: "left-sidebar",
			}
		);
	});

	it("activator defaults to tab placement", async () => {
		const mockPlugin = {
			app: { workspace: { name: "workspace" } },
			registerView: vi.fn(),
		} as any;

		const config: ViewComponentConfig = {
			viewType: "test-view",
			displayText: "Test View",
			cls: "test-cls",
			render: vi.fn(),
		};

		const activator = registerComponentView(mockPlugin, config);
		await activator();

		expect(mockActivateView).toHaveBeenCalledWith(
			{ name: "workspace" },
			{
				viewType: "test-view",
				placement: "tab",
			}
		);
	});

	it("view factory produces a view with correct metadata", () => {
		let factory: ((leaf: any) => any) | null = null;
		const mockPlugin = {
			app: { workspace: {} },
			registerView: vi.fn((_type: string, f: (leaf: any) => any) => {
				factory = f;
			}),
		} as any;

		const config: ViewComponentConfig = {
			viewType: "my-view",
			displayText: "My View",
			icon: "globe",
			cls: "my-view-root",
			render: vi.fn(),
		};

		registerComponentView(mockPlugin, config);

		const mockLeaf = { app: { name: "test" }, detach: vi.fn() };
		const view = factory!(mockLeaf);

		expect(view.getViewType()).toBe("my-view");
		expect(view.getDisplayText()).toBe("My View");
		expect(view.getIcon()).toBe("globe");
	});

	it("view factory defaults icon to layout", () => {
		let factory: ((leaf: any) => any) | null = null;
		const mockPlugin = {
			app: { workspace: {} },
			registerView: vi.fn((_type: string, f: (leaf: any) => any) => {
				factory = f;
			}),
		} as any;

		registerComponentView(mockPlugin, {
			viewType: "v",
			displayText: "V",
			cls: "v-root",
			render: vi.fn(),
		});

		const view = factory!({ app: { name: "test" }, detach: vi.fn() });
		expect(view.getIcon()).toBe("layout");
	});

	it("view onOpen calls render with root element and ViewContext", async () => {
		let factory: ((leaf: any) => any) | null = null;
		const renderSpy = vi.fn();

		const mockPlugin = {
			app: { workspace: {} },
			registerView: vi.fn((_type: string, f: (leaf: any) => any) => {
				factory = f;
			}),
		} as any;

		registerComponentView(mockPlugin, {
			viewType: "v",
			displayText: "V",
			cls: "my-class",
			render: renderSpy,
		});

		const mockLeaf = { app: { name: "test" }, detach: vi.fn() };
		const view = factory!(mockLeaf);

		const root = view.containerEl.children[1] as HTMLElement;
		(root as any).empty = () => {
			root.innerHTML = "";
		};
		(root as any).addClass = (cls: string) => root.classList.add(cls);

		await view.onOpen();

		expect(renderSpy).toHaveBeenCalledOnce();
		expect(renderSpy.mock.calls[0][0]).toBe(root);

		const ctx = renderSpy.mock.calls[0][1] as ViewContext;
		expect(ctx.type).toBe("view");
		expect(ctx.app).toEqual({ name: "test" });
		expect(ctx.leaf).toBe(mockLeaf);
		expect(typeof ctx.close).toBe("function");
		expect(ctx.headerEl).toBe(view.containerEl.children[0]);
		expect(root.classList.contains("my-class")).toBe(true);
	});

	it("view onClose calls cleanup", async () => {
		let factory: ((leaf: any) => any) | null = null;
		const cleanupSpy = vi.fn();

		const mockPlugin = {
			app: { workspace: {} },
			registerView: vi.fn((_type: string, f: (leaf: any) => any) => {
				factory = f;
			}),
		} as any;

		registerComponentView(mockPlugin, {
			viewType: "v",
			displayText: "V",
			cls: "v-root",
			render: vi.fn(),
			cleanup: cleanupSpy,
		});

		const view = factory!({ app: { name: "test" }, detach: vi.fn() });
		await view.onClose();

		expect(cleanupSpy).toHaveBeenCalledOnce();
	});
});
