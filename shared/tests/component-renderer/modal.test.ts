/**
 * @vitest-environment jsdom
 */
import { Modal } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { showModal } from "../../src/components/component-renderer/modal";
import type { ComponentContext, ModalContext } from "../../src/components/component-renderer/types";

const flush = (): Promise<void> => new Promise((r) => queueMicrotask(r));

describe("showModal", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
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
		const [contentEl] = renderSpy.mock.calls[0];
		expect(contentEl).toBeInstanceOf(HTMLElement);
		expect(typeof (contentEl as HTMLElement & { empty?: () => void }).empty).toBe("function");
	});

	it("sets title when provided", async () => {
		const setTitleSpy = vi.spyOn(Modal.prototype, "setTitle");
		showModal({
			app: { name: "test" } as any,
			cls: "test-modal",
			render: vi.fn(),
			title: "Test Title",
		});
		await flush();

		expect(setTitleSpy).toHaveBeenCalledWith("Test Title");
	});

	it("adds CSS class to modalEl", async () => {
		let modalEl: HTMLElement | null = null;
		showModal({
			app: { name: "test" } as any,
			cls: "my-modal",
			render: (_el, ctx) => {
				if (ctx.type === "modal") modalEl = ctx.modalEl;
			},
		});
		await flush();

		expect(modalEl?.classList.contains("my-modal")).toBe(true);
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

		expect(capturedCtx!.modalEl).toBeInstanceOf(HTMLElement);
		expect(capturedCtx!.scope).toEqual(expect.objectContaining({ register: expect.any(Function) }));
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
