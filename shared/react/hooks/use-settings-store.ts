import { useCallback, useSyncExternalStore } from "react";
import type { BehaviorSubject } from "rxjs";

interface SettingsStorelike<T> {
	settings$: BehaviorSubject<T>;
	currentSettings: T;
	updateSettings: (updater: (settings: T) => T) => Promise<void>;
}

export function useSettingsStore<T>(store: SettingsStorelike<T>): [T, (updater: (settings: T) => T) => Promise<void>] {
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const sub = store.settings$.subscribe(onStoreChange);
			return () => sub.unsubscribe();
		},
		[store]
	);

	const getSnapshot = useCallback(() => store.currentSettings, [store]);

	const settings = useSyncExternalStore(subscribe, getSnapshot);

	const update = useCallback((updater: (settings: T) => T) => store.updateSettings(updater), [store]);

	return [settings, update];
}
