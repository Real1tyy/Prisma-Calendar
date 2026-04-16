import { ItemView } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MountableView } from "../../src/components/mountable/view";

const TestMountable = MountableView(ItemView as any, "test");

class ConcreteView extends (TestMountable as any) {
	mountCalled = false;
	unmountCalled = false;
	mountError: Error | null = null;

	constructor() {
		super({ app: { workspace: { on: vi.fn() } } });
	}

	async mount(): Promise<void> {
		if (this.mountError) throw this.mountError;
		this.mountCalled = true;
	}

	async unmount(): Promise<void> {
		this.unmountCalled = true;
	}

	getViewType(): string {
		return "test-view";
	}

	getDisplayText(): string {
		return "Test View";
	}
}

describe("MountableView", () => {
	let view: ConcreteView;

	beforeEach(() => {
		view = new ConcreteView();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("onOpen", () => {
		it("should call mount on first open", async () => {
			await view.onOpen();

			expect(view.mountCalled).toBe(true);
		});

		it("should not call mount twice", async () => {
			await view.onOpen();
			view.mountCalled = false;

			await view.onOpen();

			expect(view.mountCalled).toBe(false);
		});

		it("should reset mounted state if mount throws", async () => {
			view.mountError = new Error("mount failed");

			await expect(view.onOpen()).rejects.toThrow("mount failed");

			view.mountError = null;
			await view.onOpen();
			expect(view.mountCalled).toBe(true);
		});
	});

	describe("onClose", () => {
		it("should call unmount", async () => {
			await view.onOpen();
			await view.onClose();

			expect(view.unmountCalled).toBe(true);
		});

		it("should allow re-mounting after close", async () => {
			await view.onOpen();
			await view.onClose();
			view.mountCalled = false;

			await view.onOpen();

			expect(view.mountCalled).toBe(true);
		});
	});

	describe("showLoading / hideLoading", () => {
		it("should create loading elements in the container", () => {
			const container = document.createElement("div");

			view.showLoading(container);

			expect(container.querySelector(".test-mountable-loading-container")).toBeTruthy();
			expect(container.querySelector(".test-mountable-loading-spinner")).toBeTruthy();
			expect(container.querySelector(".test-mountable-loading-text")).toBeTruthy();
		});

		it("should display default loading text", () => {
			const container = document.createElement("div");

			view.showLoading(container);

			const textEl = container.querySelector(".test-mountable-loading-text");
			expect(textEl?.textContent).toBe("Loading\u2026");
		});

		it("should display custom loading text", () => {
			const container = document.createElement("div");

			view.showLoading(container, "Please wait...");

			const textEl = container.querySelector(".test-mountable-loading-text");
			expect(textEl?.textContent).toBe("Please wait...");
		});

		it("should use custom class names when provided", () => {
			const container = document.createElement("div");

			view.showLoading(container, "Loading", {
				container: "custom-container",
				spinner: "custom-spinner",
				text: "custom-text",
			});

			expect(container.querySelector(".custom-container")).toBeTruthy();
			expect(container.querySelector(".custom-spinner")).toBeTruthy();
			expect(container.querySelector(".custom-text")).toBeTruthy();
		});

		it("should remove previous loading indicator before showing a new one", () => {
			const container = document.createElement("div");

			view.showLoading(container, "First");
			view.showLoading(container, "Second");

			const loadingEls = container.querySelectorAll(".test-mountable-loading-container");
			expect(loadingEls).toHaveLength(1);
			expect(loadingEls[0].querySelector(".test-mountable-loading-text")?.textContent).toBe("Second");
		});

		it("should remove loading indicator on hideLoading", () => {
			const container = document.createElement("div");

			view.showLoading(container);
			view.hideLoading();

			expect(container.querySelector(".test-mountable-loading-container")).toBeNull();
		});

		it("should be safe to call hideLoading when no loading is shown", () => {
			expect(() => view.hideLoading()).not.toThrow();
		});
	});

	describe("prefix behavior", () => {
		it("should use default prefix when none provided", () => {
			const UnprefixedMountable = MountableView(ItemView as any);

			class UnprefixedView extends (UnprefixedMountable as any) {
				constructor() {
					super({ app: { workspace: { on: vi.fn() } } });
				}
				async mount(): Promise<void> {}
				async unmount(): Promise<void> {}
				getViewType(): string {
					return "test";
				}
				getDisplayText(): string {
					return "Test";
				}
			}

			const v = new UnprefixedView();
			const container = document.createElement("div");
			v.showLoading(container);

			expect(container.querySelector(".mountable-loading-container")).toBeTruthy();
		});
	});
});
