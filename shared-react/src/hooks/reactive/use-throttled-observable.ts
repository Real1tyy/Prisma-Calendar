import { useMemo } from "react";
import { asyncScheduler, type Observable, throttleTime } from "rxjs";

import { useObservable } from "./use-observable";

/**
 * Subscribe to an Observable that coalesces bursty emissions via
 * `throttleTime`. First emission goes through immediately (leading), the final
 * value of a burst arrives after the quiet window (trailing), intermediate
 * emissions within the window are dropped.
 *
 * Use this when a single source fires many times in quick succession (bulk
 * file ops, per-row vault index updates, etc.) and downstream React work is
 * expensive — e.g. a chart redraw or a large list reflow. The defaults
 * (asyncScheduler, leading + trailing) match the "settled-state" UX most
 * settings pages want and are easy to get wrong inline.
 *
 * Compose explicit `pipe(debounceTime|auditTime|...)` operators upstream when
 * you need a different shape — this hook is intentionally limited to
 * throttle.
 */
export function useThrottledObservable<T>(observable$: Observable<T>, ms: number, initial: T): T {
	const throttled$ = useMemo(
		() => observable$.pipe(throttleTime(ms, asyncScheduler, { leading: true, trailing: true })),
		[observable$, ms]
	);
	return useObservable(throttled$, initial);
}
