import { renderHook } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusOnMount,type UseFocusOnMountOptions } from "../../src/hooks/use-focus-on-mount";

function renderFocusHook(el: HTMLElement, options?: UseFocusOnMountOptions) {
	return renderHook(
		(props: { options?: UseFocusOnMountOptions }) => {
			const ref = useRef<HTMLElement | null>(el);
			ref.current = el;
			useFocusOnMount(ref as RefObject<HTMLElement | null>, props.options);
		},
		{ initialProps: { options } }
	);
}

describe("useFocusOnMount", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("focuses the element synchronously when delayMs is 0", () => {
		const input = document.body.appendChild(document.createElement("input"));
		expect(document.activeElement).not.toBe(input);

		renderFocusHook(input);

		expect(document.activeElement).toBe(input);

		input.remove();
	});

	it("waits the configured delay before focusing", () => {
		const input = document.body.appendChild(document.createElement("input"));

		renderFocusHook(input, { delayMs: 50 });

		expect(document.activeElement).not.toBe(input);
		vi.advanceTimersByTime(49);
		expect(document.activeElement).not.toBe(input);
		vi.advanceTimersByTime(1);
		expect(document.activeElement).toBe(input);

		input.remove();
	});

	it("is a no-op when disabled", () => {
		const input = document.body.appendChild(document.createElement("input"));

		renderFocusHook(input, { enabled: false, delayMs: 10 });

		vi.advanceTimersByTime(100);
		expect(document.activeElement).not.toBe(input);

		input.remove();
	});

	it("cancels a pending focus on unmount", () => {
		const input = document.body.appendChild(document.createElement("input"));

		const { unmount } = renderFocusHook(input, { delayMs: 50 });

		unmount();
		vi.advanceTimersByTime(100);
		expect(document.activeElement).not.toBe(input);

		input.remove();
	});

	it("cancels pending focus when enabled flips to false mid-delay", () => {
		const input = document.body.appendChild(document.createElement("input"));

		const { rerender } = renderHook(
			(props: { options: UseFocusOnMountOptions }) => {
				const ref = useRef<HTMLElement | null>(input);
				ref.current = input;
				useFocusOnMount(ref as RefObject<HTMLElement | null>, props.options);
			},
			{ initialProps: { options: { delayMs: 50, enabled: true } } }
		);

		vi.advanceTimersByTime(20);
		rerender({ options: { delayMs: 50, enabled: false } });
		vi.advanceTimersByTime(100);
		expect(document.activeElement).not.toBe(input);

		input.remove();
	});
});
