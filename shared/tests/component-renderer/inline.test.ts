/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import { renderInline } from "../../src/components/component-renderer/inline";
import type { ComponentContext, InlineContext } from "../../src/components/component-renderer/types";

describe("renderInline", () => {
	it("calls the render function with the container and an InlineContext", () => {
		const container = document.createElement("div");
		const renderSpy = vi.fn();
		const mockApp = { name: "test" } as any;

		renderInline(container, renderSpy, mockApp);

		expect(renderSpy).toHaveBeenCalledOnce();
		expect(renderSpy.mock.calls[0][0]).toBe(container);

		const ctx = renderSpy.mock.calls[0][1] as InlineContext;
		expect(ctx.type).toBe("inline");
		expect(ctx.app).toBe(mockApp);
		expect(typeof ctx.close).toBe("function");
	});

	it("returns a cleanup function that empties the container", () => {
		const container = document.createElement("div");
		const mockApp = { name: "test" } as any;

		const cleanup = renderInline(
			container,
			(el) => {
				el.innerHTML += "<span>rendered</span>";
			},
			mockApp
		);

		expect(container.innerHTML).toContain("rendered");

		cleanup();
		expect(container.innerHTML).toBe("");
	});

	it("close in context empties the container", () => {
		const container = document.createElement("div");
		let capturedCtx: ComponentContext | null = null;
		const mockApp = { name: "test" } as any;

		renderInline(
			container,
			(el, ctx) => {
				capturedCtx = ctx;
				el.innerHTML = "<div>content</div>";
			},
			mockApp
		);

		expect(container.innerHTML).toContain("content");

		capturedCtx!.close();
		expect(container.innerHTML).toBe("");
	});

	it("context type is inline with no leaf, modalEl, or scope", () => {
		const container = document.createElement("div");
		let capturedCtx: ComponentContext | null = null;
		const mockApp = { name: "test" } as any;

		renderInline(
			container,
			(_el, ctx) => {
				capturedCtx = ctx;
			},
			mockApp
		);

		expect(capturedCtx!.type).toBe("inline");
		expect("leaf" in capturedCtx!).toBe(false);
		expect("modalEl" in capturedCtx!).toBe(false);
		expect("scope" in capturedCtx!).toBe(false);
	});
});
