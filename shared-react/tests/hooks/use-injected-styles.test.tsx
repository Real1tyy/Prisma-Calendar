import { readInjectedStyleSheet } from "@real1ty/obsidian-plugins";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useInjectedStyles } from "../../src/hooks/styles/use-styles";

function uniqueId(): string {
	return `test-style-${Math.random().toString(36).slice(2)}`;
}

describe("useInjectedStyles", () => {
	it("adopts a stylesheet carrying the given css under the given id", () => {
		const id = uniqueId();
		const css = ".foo { color: red; }";

		renderHook(() => useInjectedStyles(id, css));

		expect(readInjectedStyleSheet(id)).toBe(css);
	});

	it("adopts exactly one sheet across multiple mounts of the same id", () => {
		const id = uniqueId();
		const before = document.adoptedStyleSheets.length;

		renderHook(() => useInjectedStyles(id, ".a {}"));
		renderHook(() => useInjectedStyles(id, ".a {}"));
		renderHook(() => useInjectedStyles(id, ".a {}"));

		expect(document.adoptedStyleSheets.length - before).toBe(1);
	});

	it("never attaches a style element — Obsidian forbids them", () => {
		const id = uniqueId();

		renderHook(() => useInjectedStyles(id, ".foo { color: red; }"));

		expect(document.getElementById(id)).toBeNull();
		expect(document.head.querySelector("style")).toBeNull();
	});
});
