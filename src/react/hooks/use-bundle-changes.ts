import { useSubscription } from "@real1ty-obsidian-plugins-react";
import { useMemo, useState } from "react";
import { debounceTime, merge, type Observable } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";

interface UseBundleChangesOptions {
	debounceMs?: number;
	extra?: ReadonlyArray<Observable<unknown>>;
}

/**
 * Subscribe to the canonical bundle "data changed" sources — event store +
 * recurring event manager — plus any extra streams a view also reacts to.
 * Returns a render token that increments on every emission so memos keyed on
 * it recompute. Replaces the ad-hoc `merge(eventStore.changes$, recurring.changes$, …)`
 * pattern duplicated across tab views.
 */
export function useBundleChanges(bundle: CalendarBundle, options?: UseBundleChangesOptions): number {
	const { debounceMs, extra } = options ?? {};
	const [token, setToken] = useState(0);

	const changes$ = useMemo(() => {
		const sources: Observable<unknown>[] = [bundle.eventStore.changes$, bundle.recurringEventManager.changes$];
		if (extra) sources.push(...extra);
		const merged = merge(...sources);
		return debounceMs ? merged.pipe(debounceTime(debounceMs)) : merged;
	}, [bundle, extra, debounceMs]);

	useSubscription(changes$, () => setToken((n) => n + 1));

	return token;
}
