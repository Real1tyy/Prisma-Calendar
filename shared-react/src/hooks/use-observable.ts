import { useEffect, useState } from "react";
import type { Observable } from "rxjs";

/**
 * Subscribe to an Observable and re-render with each emission. Cancellation,
 * re-subscription on dep change, and unmount cleanup are handled by the hook —
 * compose `switchMap`/`combineLatest` upstream instead of juggling
 * `useEffect` + cancellation flags by hand.
 *
 * Returns `undefined` until the first emission; pass `initial` to skip the
 * undefined window. For sources that already expose a synchronous current
 * value (BehaviorSubject-backed stores), prefer `useExternalSnapshot`.
 */
export function useObservable<T>(observable$: Observable<T>, initial: T): T;
export function useObservable<T>(observable$: Observable<T>): T | undefined;
export function useObservable<T>(observable$: Observable<T>, initial?: T): T | undefined {
	const [value, setValue] = useState<T | undefined>(initial);

	useEffect(() => {
		const sub = observable$.subscribe(setValue);
		return () => sub.unsubscribe();
	}, [observable$]);

	return value;
}
