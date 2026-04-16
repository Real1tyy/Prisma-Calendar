import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useInjectedStyles } from "../../src/hooks/use-injected-styles";

describe("useInjectedStyles", () => {
	it("injects a <style> element with the given id and css", () => {
		const id = `test-style-${Math.random().toString(36).slice(2)}`;
		const css = ".foo { color: red; }";
		renderHook(() => useInjectedStyles(id, css));

		const el = document.getElementById(id);
		expect(el).not.toBeNull();
		expect(el?.tagName).toBe("STYLE");
		expect(el?.textContent).toBe(css);
	});

	it("is idempotent across multiple mounts of the same id", () => {
		const id = `test-style-${Math.random().toString(36).slice(2)}`;
		renderHook(() => useInjectedStyles(id, ".a {}"));
		renderHook(() => useInjectedStyles(id, ".a {}"));
		renderHook(() => useInjectedStyles(id, ".a {}"));

		expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
	});
});
