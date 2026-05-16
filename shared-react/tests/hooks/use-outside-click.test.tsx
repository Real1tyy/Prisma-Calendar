import { renderHook } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useOutsideClick, type UseOutsideClickOptions } from "../../src/hooks/dom/use-outside-click";

function renderOutsideClickHook(
	elements: HTMLElement[],
	onOutside: (e: MouseEvent) => void,
	options?: UseOutsideClickOptions
) {
	return renderHook(
		(props: { onOutside: (e: MouseEvent) => void; options?: UseOutsideClickOptions }) => {
			const refs = elements.map((el) => {
				const ref = useRef<HTMLElement | null>(el);
				ref.current = el;
				return ref as RefObject<HTMLElement | null>;
			});
			useOutsideClick(refs, props.onOutside, props.options);
		},
		{ initialProps: { onOutside, options } }
	);
}

function dispatchMouse(target: EventTarget, event: "mousedown" | "click"): MouseEvent {
	const ev = new MouseEvent(event, { bubbles: true });
	target.dispatchEvent(ev);
	return ev;
}

describe("useOutsideClick", () => {
	it("fires when a mousedown lands outside the ref's subtree", () => {
		const inside = document.body.appendChild(document.createElement("div"));
		const outside = document.body.appendChild(document.createElement("div"));
		const handler = vi.fn();

		renderOutsideClickHook([inside], handler);

		dispatchMouse(outside, "mousedown");
		expect(handler).toHaveBeenCalledTimes(1);

		inside.remove();
		outside.remove();
	});

	it("does not fire when the click is inside the ref's subtree", () => {
		const inside = document.body.appendChild(document.createElement("div"));
		const child = inside.appendChild(document.createElement("span"));
		const handler = vi.fn();

		renderOutsideClickHook([inside], handler);

		dispatchMouse(child, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		inside.remove();
	});

	it("treats a click inside any registered ref as 'inside' (multi-ref)", () => {
		const dropdown = document.body.appendChild(document.createElement("div"));
		const button = document.body.appendChild(document.createElement("button"));
		const outside = document.body.appendChild(document.createElement("div"));
		const handler = vi.fn();

		renderOutsideClickHook([dropdown, button], handler);

		dispatchMouse(dropdown, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		dispatchMouse(button, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		dispatchMouse(outside, "mousedown");
		expect(handler).toHaveBeenCalledTimes(1);

		dropdown.remove();
		button.remove();
		outside.remove();
	});

	it("listens on the configured event phase", () => {
		const inside = document.body.appendChild(document.createElement("div"));
		const outside = document.body.appendChild(document.createElement("div"));
		const handler = vi.fn();

		renderOutsideClickHook([inside], handler, { event: "click" });

		dispatchMouse(outside, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		dispatchMouse(outside, "click");
		expect(handler).toHaveBeenCalledTimes(1);

		inside.remove();
		outside.remove();
	});

	it("is a no-op when disabled", () => {
		const inside = document.body.appendChild(document.createElement("div"));
		const outside = document.body.appendChild(document.createElement("div"));
		const handler = vi.fn();

		renderOutsideClickHook([inside], handler, { enabled: false });

		dispatchMouse(outside, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		inside.remove();
		outside.remove();
	});

	it("respects shouldIgnore predicate", () => {
		const inside = document.body.appendChild(document.createElement("div"));
		const outside = document.body.appendChild(document.createElement("div"));
		const handler = vi.fn();
		let ignore = true;

		renderOutsideClickHook([inside], handler, { shouldIgnore: () => ignore });

		dispatchMouse(outside, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		ignore = false;
		dispatchMouse(outside, "mousedown");
		expect(handler).toHaveBeenCalledTimes(1);

		inside.remove();
		outside.remove();
	});

	it("detaches the document listener on unmount", () => {
		const inside = document.body.appendChild(document.createElement("div"));
		const outside = document.body.appendChild(document.createElement("div"));
		const handler = vi.fn();

		const { unmount } = renderOutsideClickHook([inside], handler);

		unmount();
		dispatchMouse(outside, "mousedown");
		expect(handler).not.toHaveBeenCalled();

		inside.remove();
		outside.remove();
	});
});
