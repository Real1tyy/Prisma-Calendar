import { afterEach, beforeEach, vi } from "vitest";

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

/**
 * Silences the specified console methods for the enclosing describe block.
 * Intended for tests that deliberately exercise error paths where the source
 * code calls `console.error` / `console.warn`. Silencing at the test boundary
 * (not the source) keeps real regressions visible elsewhere.
 *
 * Re-applies per-test so it survives `vi.restoreAllMocks()` in sibling
 * `afterEach` hooks. Must be called inside a describe block.
 */
export function silenceConsole(methods: ConsoleMethod[] = ["error", "warn"]): void {
	const spies: ReturnType<typeof vi.spyOn>[] = [];

	beforeEach(() => {
		for (const method of methods) {
			spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
		}
	});

	afterEach(() => {
		for (const spy of spies) spy.mockRestore();
		spies.length = 0;
	});
}
