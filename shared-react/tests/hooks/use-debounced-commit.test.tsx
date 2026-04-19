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

	it("routes a pending draft to the onCommit active at edit time, not at timer fire", () => {
		// Simulates a settings pane that re-binds `onCommit` to a different entity
		// while a debounced draft is still pending — e.g. user types in calendar A's
		// directory field, then the pane switches to calendar B mid-debounce. The
		// pending write must land on A, not B.
		const onCommitA = vi.fn();
		const onCommitB = vi.fn();
		const { result, rerender } = renderHook(
			({ onCommit }: { onCommit: (v: string) => void }) => useDebouncedCommit({ value: "", onCommit, debounceMs: 300 }),
			{ initialProps: { onCommit: onCommitA } }
		);

		act(() => result.current.setDraft("CalendarA"));
		rerender({ onCommit: onCommitB });

		act(() => {
			vi.advanceTimersByTime(300);
		});

		expect(onCommitA).toHaveBeenCalledTimes(1);
		expect(onCommitA).toHaveBeenCalledWith("CalendarA");
		expect(onCommitB).not.toHaveBeenCalled();
	});

	it("routes a flushed draft to the onCommit active at edit time", () => {
		const onCommitA = vi.fn();
		const onCommitB = vi.fn();
		const { result, rerender } = renderHook(
			({ onCommit }: { onCommit: (v: string) => void }) =>
				useDebouncedCommit({ value: "", onCommit, debounceMs: 5_000 }),
			{ initialProps: { onCommit: onCommitA } }
		);

		act(() => result.current.setDraft("draft"));
		rerender({ onCommit: onCommitB });
		act(() => result.current.flush());

		expect(onCommitA).toHaveBeenCalledTimes(1);
		expect(onCommitA).toHaveBeenCalledWith("draft");
		expect(onCommitB).not.toHaveBeenCalled();
	});

	it("unmount flush routes to the onCommit active at edit time", () => {
		const onCommitA = vi.fn();
		const onCommitB = vi.fn();
		const { result, rerender, unmount } = renderHook(
			({ onCommit }: { onCommit: (v: string) => void }) =>
				useDebouncedCommit({ value: "", onCommit, debounceMs: 5_000 }),
			{ initialProps: { onCommit: onCommitA } }
		);

		act(() => result.current.setDraft("draft"));
		rerender({ onCommit: onCommitB });
		unmount();

		expect(onCommitA).toHaveBeenCalledTimes(1);
		expect(onCommitA).toHaveBeenCalledWith("draft");
		expect(onCommitB).not.toHaveBeenCalled();
	});

	it("commitImmediate uses the latest onCommit (fresh explicit action, not deferred edit)", () => {
		const onCommitA = vi.fn();
		const onCommitB = vi.fn();
		const { result, rerender } = renderHook(
			({ onCommit }: { onCommit: (v: string) => void }) => useDebouncedCommit({ value: "", onCommit, debounceMs: 300 }),
			{ initialProps: { onCommit: onCommitA } }
		);

		rerender({ onCommit: onCommitB });
		act(() => result.current.commitImmediate("now"));

		expect(onCommitB).toHaveBeenCalledTimes(1);
		expect(onCommitB).toHaveBeenCalledWith("now");
		expect(onCommitA).not.toHaveBeenCalled();
	});
});
