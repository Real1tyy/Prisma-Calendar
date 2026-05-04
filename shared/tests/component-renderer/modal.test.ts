/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentContext, ModalContext } from "../../src/components/component-renderer/types";

let mockContentEl: HTMLElement;
let mockModalEl: HTMLElement;
let mockScope: Record<string, unknown>;

vi.mock("obsidian", () => {
	class MockModal {
		contentEl: HTMLElement;
		modalEl: HTMLElement;
		scope: Record<string, unknown>;
		app: { name: string };

		constructor(app: { name: string }) {
			this.app = app;
			this.contentEl = mockContentEl;
			this.modalEl = mockModalEl;
			this.scope = mockScope;
		}

		open(): void {
			void (this as any).onOpen();
		}

		close(): void {}

		setTitle(title: string): void {
			this.contentEl.dataset.title = title;
		}
	}

	return { Modal: MockModal };
});

const { showModal } = await import("../../src/components/component-renderer/modal");

const flush = (): Promise<void> => new Promise((r) => queueMicrotask(r));

describe("showModal", () => {
	beforeEach(() => {
		mockContentEl = document.createElement("div");
		(mockContentEl as any).addClass = (cls: string) => mockContentEl.classList.add(cls);
		(mockContentEl as any).empty = () => {
			while (mockContentEl.firstChild) mockContentEl.removeChild(mockContentEl.firstChild);
		};
		mockModalEl = document.createElement("div");
		(mockModalEl as any).addClass = (cls: string) => mockModalEl.classList.add(cls);
		mockScope = { register: vi.fn() };
	});

	it("calls the render function with contentEl", async () => {
		const renderSpy = vi.fn();

		showModal({
			app: { name: "test" } as any,
			cls: "test-modal",
			render: renderSpy,
		});
		await flush();

		expect(renderSpy).toHaveBeenCalledOnce();
		expect(renderSpy.mock.calls[0][0]).toBe(mockContentEl);
	});

	it("sets title when provided", async () => {
		showModal({
			app: { name: "test" } as any,
			cls: "test-modal",
			render: vi.fn(),
			title: "Test Title",
		});
		await flush();

		expect(mockContentEl.dataset.title).toBe("Test Title");
	});

	it("adds CSS class to modalEl", async () => {
		showModal({
			app: { name: "test" } as any,
			cls: "my-modal",
			render: vi.fn(),
		});
		await flush();

		expect(mockModalEl.classList.contains("my-modal")).toBe(true);
	});

	it("provides a ModalContext with type discriminant", async () => {
		let capturedCtx: ComponentContext | null = null;

		showModal({
			app: { name: "test" } as any,
			cls: "test-modal",
			render: (_el, ctx) => {
				capturedCtx = ctx;
			},
		});
		await flush();

		expect(capturedCtx).not.toBeNull();
		expect(capturedCtx!.type).toBe("modal");
		expect(typeof capturedCtx!.close).toBe("function");
	});

	it("provides modalEl and scope in modal context", async () => {
		let capturedCtx: ModalContext | null = null;

		showModal({
			app: { name: "test" } as any,
			cls: "test-modal",
			render: (_el, ctx) => {
				if (ctx.type === "modal") capturedCtx = ctx;
			},
		});
		await flush();

		expect(capturedCtx!.modalEl).toBe(mockModalEl);
		expect(capturedCtx!.scope).toBe(mockScope);
	});

	it("calls cleanup on close", async () => {
		const cleanupSpy = vi.fn();

		showModal({
			app: { name: "test" } as any,
			cls: "test-modal",
			render: vi.fn(),
			cleanup: cleanupSpy,
		});
		await flush();

		expect(cleanupSpy).not.toHaveBeenCalled();
	});
});
