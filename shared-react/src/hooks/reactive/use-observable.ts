import { useEffect, useRef, useState } from "react";
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

/**
 * Subscribe to an Observable purely for side effects — bump a render token,
 * call `.refresh()`, rebuild, etc. The subscription is created in an effect,
 * torn down on unmount or when `observable$` changes identity.
 *
 * The latest `onNext` is read through a ref, so passing a new function does
 * not resubscribe. Stabilize `observable$` with `useMemo` if it is built from
 * `merge`/`pipe`/etc. so the hook does not re-subscribe every render.
 *
 * For sources whose emitted value you want to keep in render state, prefer
 * `useObservable` or `useExternalSnapshot`.
 */
export function useSubscription<T>(observable$: Observable<T>, onNext: (value: T) => void): void {
	const onNextRef = useRef(onNext);
	useEffect(() => {
		onNextRef.current = onNext;
	});

	useEffect(() => {
		const sub = observable$.subscribe((value) => onNextRef.current(value));
		return () => sub.unsubscribe();
	}, [observable$]);
}
