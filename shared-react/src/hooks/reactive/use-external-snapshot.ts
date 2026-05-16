import { useCallback, useSyncExternalStore } from "react";

/**
 * Minimal contract any synchronous-snapshot source must satisfy to bridge into
 * React. BehaviorSubject, custom atoms, or any store with `getValue` +
 * `subscribe` fits. Intentionally does *not* couple to RxJS — see
 * `use-behavior-subject-value` for the RxJS-shaped helper.
 */
export interface SnapshotSubscribable<T> {
	subscribe(listener: () => void): { unsubscribe(): void };
	getValue(): T;
}

/**
 * Bridge any snapshot-subscribable source into React via `useSyncExternalStore`.
 *
 * NOTE: correctness depends on the source emitting a NEW reference when the
 * value changes. Mutating in place will not trigger re-renders because React
 * compares snapshots by `Object.is`.
 */
export function useExternalSnapshot<T>(source: SnapshotSubscribable<T>): T {
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const sub = source.subscribe(onStoreChange);
			return () => sub.unsubscribe();
		},
		[source]
	);

	const getSnapshot = useCallback(() => source.getValue(), [source]);

	return useSyncExternalStore(subscribe, getSnapshot);
}
