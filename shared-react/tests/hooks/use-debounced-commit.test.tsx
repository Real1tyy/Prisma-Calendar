import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEBOUNCED_COMMIT_DEFAULT_MS, useDebouncedCommit } from "../../src/hooks/use-debounced-commit";

describe("useDebouncedCommit", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("exposes the initial value as the draft and does not commit", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useDebouncedCommit({ value: "foo", onCommit, debounceMs: 50 }));

		expect(result.current.draft).toBe("foo");
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("waits the full debounce window before committing the final value of a burst", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useDebouncedCommit({ value: "", onCommit, debounceMs: 300 }));

		act(() => result.current.setDraft("e"));
		act(() => {
			vi.advanceTimersByTime(50);
		});
		act(() => result.current.setDraft("ev"));
		act(() => {
			vi.advanceTimersByTime(50);
		});
		act(() => result.current.setDraft("event"));
		expect(onCommit).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(299);
		});
		expect(onCommit).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("event");
	});

	it("flush() commits pending work immediately and cancels the timer", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useDebouncedCommit({ value: "", onCommit, debounceMs: 1_000 }));

		act(() => result.current.setDraft("abc"));
		act(() => result.current.flush());

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("abc");

		// No further call even after the debounce window would have elapsed.
		act(() => {
			vi.advanceTimersByTime(2_000);
		});
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it("flush() is a no-op when nothing is pending", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useDebouncedCommit({ value: "foo", onCommit, debounceMs: 300 }));

		act(() => result.current.flush());
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("commitImmediate() bypasses the debounce", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useDebouncedCommit({ value: "", onCommit, debounceMs: 300 }));

		act(() => result.current.commitImmediate("done"));

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("done");
		expect(result.current.draft).toBe("done");
	});

	it("adopts external `value` into the draft when no edit is pending", () => {
		const onCommit = vi.fn();
		const { result, rerender } = renderHook(
			({ value }: { value: string }) => useDebouncedCommit({ value, onCommit, debounceMs: 300 }),
			{
				initialProps: { value: "a" },
			}
		);

		rerender({ value: "b" });
		expect(result.current.draft).toBe("b");
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("keeps the in-flight draft when external `value` changes mid-edit", () => {
		const onCommit = vi.fn();
		const { result, rerender } = renderHook(
			({ value }: { value: string }) => useDebouncedCommit({ value, onCommit, debounceMs: 300 }),
			{
				initialProps: { value: "" },
			}
		);

		act(() => result.current.setDraft("abc"));
		rerender({ value: "zzz" });

		// The user is mid-typing — do not clobber the draft with the stale prop.
		expect(result.current.draft).toBe("abc");
	});

	it("flushes pending work on unmount so in-flight edits aren't dropped", () => {
		const onCommit = vi.fn();
		const { result, unmount } = renderHook(() => useDebouncedCommit({ value: "", onCommit, debounceMs: 5_000 }));

		act(() => result.current.setDraft("final"));
		unmount();

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("final");
	});

	it("restarts the debounce timer on every setDraft call", () => {
		const onCommit = vi.fn();
		const { result } = renderHook(() => useDebouncedCommit({ value: "", onCommit, debounceMs: 300 }));

		// Each setDraft resets the 300ms window. Bursting at 100ms ticks should
		// never fire a commit until the user pauses.
		for (let i = 0; i < 10; i++) {
			act(() => result.current.setDraft(`v${i}`));
			act(() => {
				vi.advanceTimersByTime(100);
			});
		}
		expect(onCommit).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("v9");
	});

	it("uses 300ms as the documented default debounce", () => {
		expect(DEBOUNCED_COMMIT_DEFAULT_MS).toBe(300);
	});
});
