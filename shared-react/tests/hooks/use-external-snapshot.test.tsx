import { act, renderHook } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { useExternalSnapshot } from "../../src/hooks/use-external-snapshot";

describe("useExternalSnapshot", () => {
	it("returns the initial value from the source", () => {
		const subject = new BehaviorSubject(0);
		const { result } = renderHook(() => useExternalSnapshot(subject));

		expect(result.current).toBe(0);
	});

	it("re-renders when the source emits a new reference", () => {
		const subject = new BehaviorSubject({ n: 1 });
		const { result } = renderHook(() => useExternalSnapshot(subject));

		act(() => {
			subject.next({ n: 2 });
		});

		expect(result.current).toEqual({ n: 2 });
	});

	it("does NOT re-render when the same reference is re-emitted", () => {
		const initial = { n: 1 };
		const subject = new BehaviorSubject(initial);
		let renders = 0;
		renderHook(() => {
			renders += 1;
			return useExternalSnapshot(subject);
		});
		const baseline = renders;

		act(() => {
			subject.next(initial);
		});

		expect(renders).toBe(baseline);
	});

	it("unsubscribes from the source on unmount", () => {
		const unsubscribe = vi.fn();
		const source = {
			getValue: () => "hello",
			subscribe: vi.fn(() => ({ unsubscribe })),
		};
		const { unmount } = renderHook(() => useExternalSnapshot(source));

		expect(source.subscribe).toHaveBeenCalledTimes(1);

		unmount();
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});
});
