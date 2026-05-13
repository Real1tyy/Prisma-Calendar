import { useEffect, useRef } from "react";
import type { Observable } from "rxjs";

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
