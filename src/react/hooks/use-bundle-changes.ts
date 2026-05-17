import { useSubscription } from "@real1ty-obsidian-plugins-react";
import { useMemo, useState } from "react";
import { debounceTime, merge, type Observable } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";

interface UseBundleChangesOptions {
	debounceMs?: number;
	extra?: ReadonlyArray<Observable<unknown>>;
}

/**
 * Merge the canonical bundle "data changed" sources — event store + recurring
 * event manager — with any caller-supplied `extra` streams, optionally
 * debounced. Returned observable identity is stable across renders for a
 * given `(bundle, extra, debounceMs)` tuple so consumers can pass it
 * straight to `useSubscription`. Callers must memoize `extra` themselves.
 */
function useBundleChangesStream(bundle: CalendarBundle, options?: UseBundleChangesOptions): Observable<unknown> {
	const { debounceMs, extra } = options ?? {};
	return useMemo(() => {
		const sources: Observable<unknown>[] = [bundle.eventStore.changes$, bundle.recurringEventManager.changes$];
		if (extra) sources.push(...extra);
		const merged = merge(...sources);
		return debounceMs && debounceMs > 0 ? merged.pipe(debounceTime(debounceMs)) : merged;
	}, [bundle, extra, debounceMs]);
}

/**
 * Subscribe to the canonical bundle "data changed" sources — event store +
 * recurring event manager — plus any extra streams a view also reacts to.
 * Returns a render token that increments on every emission so memos and
 * effects keyed on it re-run. Replaces the hand-rolled
 * `merge(eventStore.changes$, recurring.changes$, …).pipe(debounceTime(N))`
 * + `useState` + `useSubscription` pattern duplicated across tabs and the
 * stats modal.
 */
export function useBundleChanges(bundle: CalendarBundle, options?: UseBundleChangesOptions): number {
	const [token, setToken] = useState(0);
	const changes$ = useBundleChangesStream(bundle, options);
	useSubscription(changes$, () => setToken((n) => n + 1));
	return token;
}

/**
 * Callback variant of {@link useBundleChanges} for views that already own an
 * imperative refresh handle (FullCalendar, frappe-gantt, the heatmap canvas)
 * and don't need to re-render React on every change. Fires `onChange` once per
 * debounced emission. Skip the render-token round-trip when the React subtree
 * doesn't depend on the bundle data.
 *
 * `onChange` is read through a stable subscription, so passing a new arrow
 * each render does not resubscribe.
 */
export function useBundleChangeEffect(
	bundle: CalendarBundle,
	onChange: () => void,
	options?: UseBundleChangesOptions
): void {
	const changes$ = useBundleChangesStream(bundle, options);
	useSubscription(changes$, onChange);
}
