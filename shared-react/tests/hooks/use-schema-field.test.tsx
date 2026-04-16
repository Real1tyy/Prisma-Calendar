import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSchemaField } from "../../src/hooks/use-schema-field";
import { makeStore } from "../helpers/make-store";

interface Nested {
	inner: boolean;
	other: string;
}

interface Settings {
	alpha: string;
	beta: number;
	nested: Nested;
}

const baseline: Settings = {
	alpha: "a0",
	beta: 0,
	nested: { inner: false, other: "x" },
};

describe("useSchemaField", () => {
	it("reads the value at a top-level dotted path", () => {
		const store = makeStore(baseline);
		const { result } = renderHook(() => useSchemaField<string>(store, "alpha"));

		expect(result.current.value).toBe("a0");
	});

	it("reads the value at a nested dotted path", () => {
		const store = makeStore(baseline);
		const { result } = renderHook(() => useSchemaField<boolean>(store, "nested.inner"));

		expect(result.current.value).toBe(false);
	});

	it("commits changes through store.updateSettings and reflects them on next render", async () => {
		const store = makeStore(baseline);
		const { result } = renderHook(() => useSchemaField<string>(store, "alpha"));

		await act(async () => {
			result.current.onChange("a1");
			// flush microtasks triggered by updateSettings
			await Promise.resolve();
		});

		expect(result.current.value).toBe("a1");
		expect(store.settings$.getValue().alpha).toBe("a1");
	});

	it("only re-renders when the bound path changes (sibling fields are ignored)", () => {
		const store = makeStore(baseline);
		let renders = 0;
		renderHook(() => {
			renders += 1;
			return useSchemaField<string>(store, "alpha");
		});
		const initial = renders;

		act(() => {
			store.settings$.next({ ...baseline, beta: 42 });
		});
		expect(renders).toBe(initial);

		act(() => {
			store.settings$.next({ ...baseline, alpha: "a1" });
		});
		expect(renders).toBe(initial + 1);
	});

	it("ignores sibling-key updates under a shared nested parent", () => {
		const store = makeStore(baseline);
		let renders = 0;
		renderHook(() => {
			renders += 1;
			return useSchemaField<boolean>(store, "nested.inner");
		});
		const initial = renders;

		act(() => {
			store.settings$.next({
				...baseline,
				nested: { inner: false, other: "y" },
			});
		});

		expect(renders).toBe(initial);
	});
});
