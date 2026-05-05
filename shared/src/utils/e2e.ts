/**
 * Test-environment helpers. The E2E harness sets `window.E2E = true` early in
 * `onRendererReady` (see `shared/src/testing/e2e/electron.ts`-equivalent in
 * each plugin), before any plugin code reads settings. Source code that wants
 * to short-circuit slow production behavior under tests reads the flag here.
 *
 * Do NOT use this for behavioral changes that the user might rely on — only
 * for performance hedges (debounces, polling intervals) where the production
 * delay exists to absorb user input lag and is irrelevant under automation.
 */

export function isE2E(): boolean {
	return typeof window !== "undefined" && (window as unknown as { E2E?: boolean }).E2E === true;
}

/**
 * Returns 0 under E2E so debounces don't slow tests down; otherwise returns the
 * production value. Use this for any `debounceTime(N)` that absorbs keystroke
 * cadence or settings-typing — under tests we drive inputs programmatically and
 * don't need the wait.
 */
export function debounceMsForEnv(productionMs: number): number {
	return isE2E() ? 0 : productionMs;
}
