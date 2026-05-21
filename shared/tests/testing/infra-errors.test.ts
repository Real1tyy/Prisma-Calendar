import { describe, expect, it } from "vitest";

import { formatDepsInFluxSummary, isDepResolutionError } from "../../src/testing/e2e/infra-errors";

// Real messages observed when node_modules was rebuilt mid-run (the incident the
// guard exists for) vs. genuine reds that must NOT be mislabelled as infra.
const DEP_RESOLUTION_MESSAGES: ReadonlyArray<readonly [label: string, message: string]> = [
	[
		"esm bare specifier (obsidian-launcher)",
		"Cannot find package 'obsidian-launcher' imported from /repo/shared/src/testing/e2e/bootstrap.ts",
	],
	[
		"node_modules file vanished (@playwright/test)",
		"Cannot find module '/repo/Prisma-Calendar/node_modules/@playwright/test/index.js'",
	],
	["node resolution error code", "Error [ERR_MODULE_NOT_FOUND]: Cannot resolve module"],
	["package path not exported", "Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No 'exports' main"],
];

const GENUINE_FAILURE_MESSAGES: ReadonlyArray<readonly [label: string, message: string]> = [
	["assertion failure", "frontmatter Skip did not match in Events/Standup.md\nexpect(received).toBe(expected)"],
	["bootstrap crash", "Obsidian process exited before DevTools WebSocket came up"],
	["plain timeout", "Timeout 5000ms exceeded while waiting on the predicate"],
	["unrelated module path", "Cannot find module './does-not-exist' — typo in a relative import"],
];

describe("isDepResolutionError", () => {
	it.each(DEP_RESOLUTION_MESSAGES)("flags %s as infra", (_label, message) => {
		expect(isDepResolutionError(message)).toBe(true);
	});

	it.each(GENUINE_FAILURE_MESSAGES)("does not flag %s", (_label, message) => {
		expect(isDepResolutionError(message)).toBe(false);
	});

	it.each([
		["empty string", ""],
		["null", null],
		["undefined", undefined],
	] as const)("returns false for %s", (_label, value) => {
		expect(isDepResolutionError(value)).toBe(false);
	});
});

describe("formatDepsInFluxSummary", () => {
	it("reports the unique spec count and lists each affected spec", () => {
		const summary = formatDepsInFluxSummary(["spec-a", "spec-a", "spec-b"]);

		expect(summary).toContain("2 spec(s) failed to resolve");
		expect(summary).toContain("• spec-a");
		expect(summary).toContain("• spec-b");
	});

	it("caps the listed specs at 10 and counts the remainder", () => {
		const specs = Array.from({ length: 13 }, (_unused, index) => `spec-${index}`);

		const summary = formatDepsInFluxSummary(specs);

		expect(summary).toContain("13 spec(s) failed to resolve");
		expect(summary).toContain("• spec-9");
		expect(summary).not.toContain("• spec-10");
		expect(summary).toContain("… and 3 more");
	});
});
