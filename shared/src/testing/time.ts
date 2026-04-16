import { vi } from "vitest";

/**
 * Wraps a test body with fake timers, automatically cleaning up afterward.
 *
 * @example
 * ```ts
 * it('should debounce calls', () =>
 *   withFakeTimers(async () => {
 *     trigger();
 *     trigger();
 *     advanceDebounce();
 *     expect(handler).toHaveBeenCalledOnce();
 *   })
 * );
 * ```
 */
export async function withFakeTimers(fn: () => void | Promise<void>): Promise<void> {
	vi.useFakeTimers();
	try {
		await fn();
	} finally {
		vi.useRealTimers();
	}
}

/**
 * Advances fake timers past a standard debounce interval.
 *
 * Default: 300ms (common Obsidian debounce). Override for custom intervals.
 */
export function advanceDebounce(ms = 300): void {
	vi.advanceTimersByTime(ms);
}

/**
 * Advances fake timers by the specified duration and flushes pending microtasks.
 *
 * Use when the code under test chains promises after a timer (e.g., debounce → async handler).
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
	vi.advanceTimersByTime(ms);
	// Flush pending microtasks (Promise callbacks queued by timer handlers)
	await vi.advanceTimersByTimeAsync(0);
}

/**
 * Pins `Date.now()` to a fixed timestamp for deterministic time-dependent tests.
 *
 * Returns a cleanup function. Alternatively, use `withFakeTimers` which handles cleanup.
 *
 * @example
 * ```ts
 * const cleanup = pinDateNow(new Date('2026-03-15T10:00:00'));
 * expect(Date.now()).toBe(new Date('2026-03-15T10:00:00').getTime());
 * cleanup();
 * ```
 */
export function pinDateNow(date: Date): () => void {
	vi.useFakeTimers();
	vi.setSystemTime(date);
	return () => vi.useRealTimers();
}
