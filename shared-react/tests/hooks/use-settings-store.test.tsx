import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSettingsStore } from "../../src/hooks/use-settings-store";
import { makeStore } from "../helpers/make-store";

interface TestSettings {
	count: number;
	label: string;
}

describe("useSettingsStore", () => {
	it("returns the current settings snapshot", () => {
		const store = makeStore<TestSettings>({ count: 0, label: "a" });
		const { result } = renderHook(() => useSettingsStore(store));

		expect(result.current[0]).toEqual({ count: 0, label: "a" });
	});

	it("re-renders after `update` mutates the store", async () => {
		const store = makeStore<TestSettings>({ count: 0, label: "a" });
		const { result } = renderHook(() => useSettingsStore(store));

		await act(async () => {
			await result.current[1]((s) => ({ ...s, count: 5 }));
		});

		expect(result.current[0]).toEqual({ count: 5, label: "a" });
	});

	it("keeps the `update` function identity stable across renders when the store is stable", () => {
		const store = makeStore<TestSettings>({ count: 0, label: "a" });
		const { result, rerender } = renderHook(() => useSettingsStore(store));
		const firstUpdate = result.current[1];

		rerender();

		expect(result.current[1]).toBe(firstUpdate);
	});
});
