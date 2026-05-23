import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createFrameResolver, loadBundleSourceMap, type SourceMapLookup } from "../../src/testing/stress/source-map";

// A real, minimal external source map. Its mappings decode (verified via
// node:module SourceMap) to: generated (line0, col0) → recurring-event-manager.ts
// originalLine 610 (0-based) / col 0 / name "getNextOccurrence".
const REAL_MAP = {
	version: 3,
	file: "main.js",
	sources: ["src/core/recurring-event-manager.ts"],
	names: ["getNextOccurrence"],
	mappings: "AAkmBAA,oBAKA",
	sourcesContent: [null],
};

function lookupReturning(entry: ReturnType<SourceMapLookup["findEntry"]>): {
	lookup: SourceMapLookup;
	calls: Array<[number, number]>;
} {
	const calls: Array<[number, number]> = [];
	return {
		calls,
		lookup: {
			findEntry(line, column) {
				calls.push([line, column]);
				return entry;
			},
		},
	};
}

describe("createFrameResolver", () => {
	it("resolves a matching frame, passing 0-based line/col and converting line to 1-based", () => {
		const { lookup, calls } = lookupReturning({
			originalSource: "src/x.ts",
			originalLine: 610,
			originalColumn: 8,
			name: "foo",
		});
		const resolve = createFrameResolver(lookup, { matchesBundle: () => true });

		const resolved = resolve({ url: "plugin:prisma-calendar", lineNumber: 3827, columnNumber: 120 });

		expect(resolved).toEqual({ functionName: "foo", source: "src/x.ts", line: 611, column: 8 });
		expect(calls).toEqual([[3827, 120]]);
	});

	it("defaults the column to 0 when the frame has none", () => {
		const { lookup, calls } = lookupReturning({ originalSource: "src/x.ts", originalLine: 0 });
		createFrameResolver(lookup, { matchesBundle: () => true })({ url: "main.js", lineNumber: 5 });
		expect(calls).toEqual([[5, 0]]);
	});

	it("omits functionName and column when the map lacks them", () => {
		const { lookup } = lookupReturning({ originalSource: "src/y.ts", originalLine: 0 });
		const resolved = createFrameResolver(lookup, { matchesBundle: () => true })({ url: "main.js", lineNumber: 0 });
		expect(resolved).toEqual({ source: "src/y.ts", line: 1 });
	});

	it("returns null for frames outside the bundle without consulting the map", () => {
		const { lookup, calls } = lookupReturning({ originalSource: "src/x.ts", originalLine: 0 });
		const resolve = createFrameResolver(lookup, { matchesBundle: (url) => url.endsWith("main.js") });
		expect(resolve({ url: "app://obsidian.md/app.js", lineNumber: 1 })).toBeNull();
		expect(calls).toEqual([]);
	});

	it("returns null for synthetic frames (negative line) without consulting the map", () => {
		const { lookup, calls } = lookupReturning({ originalSource: "src/x.ts", originalLine: 0 });
		const resolve = createFrameResolver(lookup, { matchesBundle: () => true });
		expect(resolve({ url: "main.js", lineNumber: -1 })).toBeNull();
		expect(calls).toEqual([]);
	});

	it("returns null when the position isn't in the map", () => {
		const { lookup } = lookupReturning({});
		const resolve = createFrameResolver(lookup, { matchesBundle: () => true });
		expect(resolve({ url: "main.js", lineNumber: 9_999, columnNumber: 0 })).toBeNull();
	});
});

describe("loadBundleSourceMap", () => {
	it("loads a real .map file and resolves a generated position back to source", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "stress-srcmap-"));
		const mapPath = path.join(dir, "main.js.map");
		writeFileSync(mapPath, JSON.stringify(REAL_MAP));
		try {
			const resolve = loadBundleSourceMap({ mapPath, matchesBundle: () => true });
			expect(resolve).not.toBeNull();
			const resolved = resolve?.({ url: "plugin:prisma-calendar", lineNumber: 0, columnNumber: 0 });
			expect(resolved).toEqual({
				functionName: "getNextOccurrence",
				source: "src/core/recurring-event-manager.ts",
				line: 611,
				column: 0,
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("returns null when the map file is missing", () => {
		expect(loadBundleSourceMap({ mapPath: "/no/such/main.js.map", matchesBundle: () => true })).toBeNull();
	});
});
