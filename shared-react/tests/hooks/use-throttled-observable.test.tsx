import { act, renderHook } from "@testing-library/react";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThrottledObservable } from "../../src/hooks/reactive/use-throttled-observable";

describe("useThrottledObservable", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the initial value before the source emits", () => {
		const subject = new Subject<number>();
		const { result } = renderHook(() => useThrottledObservable(subject, 100, -1));

		expect(result.current).toBe(-1);
	});

	it("emits the first value immediately (leading edge)", async () => {
		const subject = new Subject<number>();
		const { result } = renderHook(() => useThrottledObservable(subject, 100, -1));

		await act(async () => {
			subject.next(1);
		});

		expect(result.current).toBe(1);
	});

	it("drops intermediate emissions within the throttle window", async () => {
		const subject = new Subject<number>();
		const { result } = renderHook(() => useThrottledObservable(subject, 100, -1));

		await act(async () => {
			subject.next(1);
		});
		expect(result.current).toBe(1);

		// Burst inside the window — intermediate values must NOT land.
		await act(async () => {
			subject.next(2);
			subject.next(3);
			vi.advanceTimersByTime(20);
		});
		expect(result.current).toBe(1);
	});

	it("emits the final value of a burst after the window closes (trailing edge)", async () => {
		const subject = new Subject<number>();
		const { result } = renderHook(() => useThrottledObservable(subject, 100, -1));

		await act(async () => {
			subject.next(1);
			subject.next(2);
			subject.next(3);
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(150);
		});

		expect(result.current).toBe(3);
	});

	it("unsubscribes from the throttled stream on unmount", () => {
		const subject = new Subject<number>();
		const { unmount } = renderHook(() => useThrottledObservable(subject, 100, -1));

		expect(subject.observed).toBe(true);

		unmount();
		expect(subject.observed).toBe(false);
	});

	it("re-subscribes when the source observable identity changes", async () => {
		const first = new Subject<number>();
		const second = new Subject<number>();

		const { result, rerender } = renderHook(({ src }) => useThrottledObservable(src, 100, -1), {
			initialProps: { src: first },
		});

		await act(async () => {
			first.next(1);
		});
		expect(result.current).toBe(1);

		rerender({ src: second });
		expect(first.observed).toBe(false);
		expect(second.observed).toBe(true);

		await act(async () => {
			second.next(99);
		});
		expect(result.current).toBe(99);
	});
});
