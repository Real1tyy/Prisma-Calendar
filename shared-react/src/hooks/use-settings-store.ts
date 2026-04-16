import { useCallback } from "react";
import type { BehaviorSubject } from "rxjs";

import { useExternalSnapshot } from "./use-external-snapshot";

/**
 * Minimal shape the settings hook needs. `currentSettings` is intentionally
 * NOT required — `settings$.getValue()` covers it via BehaviorSubject.
 * Concrete stores can still expose it for non-React consumers.
 */
export interface SettingsStorelike<T> {
	settings$: BehaviorSubject<T>;
	updateSettings: (updater: (settings: T) => T) => Promise<void>;
}

export type SettingsUpdater<T> = (updater: (settings: T) => T) => Promise<void>;

export function useSettingsStore<T>(store: SettingsStorelike<T>): [T, SettingsUpdater<T>] {
	const settings = useExternalSnapshot(store.settings$);

	const update = useCallback<SettingsUpdater<T>>((updater) => store.updateSettings(updater), [store]);

	return [settings, update];
}
