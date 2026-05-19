import { renderHook } from "@testing-library/react";
import { useRef, type RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFocusOnMount, type UseFocusOnMountOptions } from "../../src/hooks/focus/use-focus";

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

	it("polls focus via RAF across the retryMs window", () => {
		const input = document.body.appendChild(document.createElement("input"));
		const rafSpy = vi.spyOn(window, "requestAnimationFrame");

		renderFocusHook(input, { retryMs: 500 });

		// Initial RAF scheduled on mount (the polling tick).
		expect(rafSpy).toHaveBeenCalled();
		const initialCount = rafSpy.mock.calls.length;

		// Each tick schedules the next one while inside the window.
		vi.advanceTimersByTime(200);
		expect(rafSpy.mock.calls.length).toBeGreaterThan(initialCount);

		rafSpy.mockRestore();
		input.remove();
	});

	it("re-focuses the input if focus drifts away mid-polling", () => {
		const input = document.body.appendChild(document.createElement("input"));
		const distractor = document.body.appendChild(document.createElement("input"));
		const focusSpy = vi.spyOn(input, "focus");

		renderFocusHook(input, { retryMs: 500 });

		expect(focusSpy).toHaveBeenCalledTimes(1);

		// Simulate Obsidian (or anything else) stealing focus mid-window.
		distractor.focus();
		const callsBeforeDrift = focusSpy.mock.calls.length;
		vi.advanceTimersByTime(50);

		// The polling tick noticed activeElement isn't us and re-focused.
		expect(focusSpy.mock.calls.length).toBeGreaterThan(callsBeforeDrift);

		focusSpy.mockRestore();
		distractor.remove();
		input.remove();
	});

	it("cancels the polling loop on unmount (no stale RAF scheduling)", () => {
		const input = document.body.appendChild(document.createElement("input"));
		const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");

		const { unmount } = renderFocusHook(input, { retryMs: 500 });

		unmount();
		expect(cancelSpy).toHaveBeenCalled();

		cancelSpy.mockRestore();
		input.remove();
	});

	it("stops polling on first user pointerdown (no focus-stealing from a deliberate click)", () => {
		const input = document.body.appendChild(document.createElement("input"));
		const distractor = document.body.appendChild(document.createElement("input"));
		const focusSpy = vi.spyOn(input, "focus");

		renderFocusHook(input, { retryMs: 500 });

		// User clicks somewhere — capture-phase listener flips the cancel flag.
		document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

		// Even if focus drifts away after the click, polling must NOT re-steal it.
		distractor.focus();
		const callsAfterClick = focusSpy.mock.calls.length;
		vi.advanceTimersByTime(500);
		expect(focusSpy.mock.calls.length).toBe(callsAfterClick);

		focusSpy.mockRestore();
		distractor.remove();
		input.remove();
	});

	it("skips the delayed focus if the user interacts during delayMs (no stale focus-steal)", () => {
		const input = document.body.appendChild(document.createElement("input"));
		const focusSpy = vi.spyOn(input, "focus");

		renderFocusHook(input, { delayMs: 100 });

		// User clicks elsewhere while the delay timer is still pending.
		vi.advanceTimersByTime(30);
		document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

		// The delay elapses, but the queued focus must NOT fire.
		vi.advanceTimersByTime(200);
		expect(focusSpy).not.toHaveBeenCalled();

		focusSpy.mockRestore();
		input.remove();
	});

	it("does not focus when the element is detached at fire time (isConnected guard)", () => {
		const input = document.createElement("input");
		document.body.appendChild(input);
		const focusSpy = vi.spyOn(input, "focus");

		renderFocusHook(input, { delayMs: 50 });

		// Detach before the timer fires.
		input.remove();
		vi.advanceTimersByTime(100);

		expect(focusSpy).not.toHaveBeenCalled();
		focusSpy.mockRestore();
	});

	it("stops polling on first user keydown", () => {
		const input = document.body.appendChild(document.createElement("input"));
		const distractor = document.body.appendChild(document.createElement("input"));
		const focusSpy = vi.spyOn(input, "focus");

		renderFocusHook(input, { retryMs: 500 });

		document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));

		distractor.focus();
		const callsAfterKey = focusSpy.mock.calls.length;
		vi.advanceTimersByTime(500);
		expect(focusSpy.mock.calls.length).toBe(callsAfterKey);

		focusSpy.mockRestore();
		distractor.remove();
		input.remove();
	});
});
