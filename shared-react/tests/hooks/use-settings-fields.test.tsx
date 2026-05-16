import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fieldsFilteredSnapshot, useSettingsFields } from "../../src/hooks/settings/use-settings-fields";
import { makeStore } from "../helpers/make-store";

interface Settings {
	alpha: string;
	beta: number;
	gamma: boolean;
	delta: string;
}

const baseline: Settings = {
	alpha: "a0",
	beta: 0,
	gamma: false,
	delta: "d0",
};

describe("fieldsFilteredSnapshot", () => {
	it("projects only the listed keys", () => {
		const store = makeStore(baseline);
		const source = fieldsFilteredSnapshot(store, ["alpha", "beta"]);

		const projection = source.getValue();
		expect(projection).toEqual({ alpha: "a0", beta: 0 });
		expect(Object.keys(projection).sort()).toEqual(["alpha", "beta"]);
	});

	it("returns the same projection reference when no listed key changes", () => {
		const store = makeStore(baseline);
		const source = fieldsFilteredSnapshot(store, ["alpha", "beta"]);

		const before = source.getValue();
		store.settings$.next({ ...baseline, gamma: true, delta: "d1" });
		const after = source.getValue();

		expect(after).toBe(before);
	});

	it("returns a new projection when any listed key changes", () => {
		const store = makeStore(baseline);
		const source = fieldsFilteredSnapshot(store, ["alpha", "beta"]);

		const before = source.getValue();
		store.settings$.next({ ...baseline, alpha: "a1" });
		const after = source.getValue();

		expect(after).not.toBe(before);
		expect(after.alpha).toBe("a1");
	});

	it("notifies subscribers only when a listed key changes", () => {
		const store = makeStore(baseline);
		const source = fieldsFilteredSnapshot(store, ["alpha", "beta"]);
		const listener = vi.fn();
		const sub = source.subscribe(listener);

		store.settings$.next({ ...baseline, gamma: true });
		expect(listener).not.toHaveBeenCalled();

		store.settings$.next({ ...baseline, beta: 42 });
		expect(listener).toHaveBeenCalledTimes(1);

		sub.unsubscribe();
	});
});

describe("useSettingsFields", () => {
	it("returns the listed fields and a partial updater", () => {
		const store = makeStore(baseline);
		const { result } = renderHook(() => useSettingsFields(store, ["alpha", "beta"]));

		const [projection, update] = result.current;
		expect(projection).toEqual({ alpha: "a0", beta: 0 });
		expect(typeof update).toBe("function");
	});

	it("partial updater merges only the patched keys via store.updateSettings", async () => {
		const store = makeStore(baseline);
		const { result } = renderHook(() => useSettingsFields(store, ["alpha", "beta"]));

		await act(async () => {
			const [, update] = result.current;
			await update({ beta: 7 });
		});

		expect(store.settings$.getValue()).toEqual({ ...baseline, beta: 7 });
		expect(result.current[0]).toEqual({ alpha: "a0", beta: 7 });
	});

	it("does not re-render when an unlisted key changes", () => {
		const store = makeStore(baseline);
		let renders = 0;
		renderHook(() => {
			renders += 1;
			return useSettingsFields(store, ["alpha", "beta"]);
		});
		const initial = renders;

		act(() => {
			store.settings$.next({ ...baseline, gamma: true });
		});

		expect(renders).toBe(initial);
	});

	it("re-renders when any listed key changes", () => {
		const store = makeStore(baseline);
		let renders = 0;
		renderHook(() => {
			renders += 1;
			return useSettingsFields(store, ["alpha", "beta"]);
		});
		const initial = renders;

		act(() => {
			store.settings$.next({ ...baseline, alpha: "a1" });
		});
		expect(renders).toBe(initial + 1);

		act(() => {
			store.settings$.next({ ...baseline, alpha: "a1", beta: 99 });
		});
		expect(renders).toBe(initial + 2);
	});

	it("infers the field types from a typed store (no <S, K> annotation)", () => {
		const store = makeStore<Settings>(baseline);
		const { result } = renderHook(() => useSettingsFields(store, ["alpha", "gamma"]));

		const [projection] = result.current;
		// Type-level assertion: projection is Pick<Settings, "alpha" | "gamma">.
		const alpha: string = projection.alpha;
		const gamma: boolean = projection.gamma;
		expect(alpha).toBe("a0");
		expect(gamma).toBe(false);
	});

	it("accepts a hoisted readonly tuple of keys (const-inference path)", () => {
		const store = makeStore<Settings>(baseline);
		const KEYS = ["alpha", "beta"] as const;
		const { result } = renderHook(() => useSettingsFields(store, KEYS));

		const [projection] = result.current;
		// Type-level: K[number] narrows to "alpha" | "beta", not generic string.
		const alpha: string = projection.alpha;
		const beta: number = projection.beta;
		expect(alpha).toBe("a0");
		expect(beta).toBe(0);
	});

	it("updater accepts a function form that sees the latest snapshot", async () => {
		const store = makeStore<Settings>({ ...baseline, beta: 1 });
		const { result } = renderHook(() => useSettingsFields(store, ["beta"]));

		// External mutation between render and setter — the function form must see it.
		await act(async () => {
			store.settings$.next({ ...baseline, beta: 10 });
			await Promise.resolve();
		});

		await act(async () => {
			const [, update] = result.current;
			await update((prev) => ({ beta: prev.beta + 5 }));
		});

		expect(store.settings$.getValue().beta).toBe(15);
	});
});
