import { BehaviorSubject } from "rxjs";

import type { SettingsStorelike } from "../../src/hooks/use-settings-store";

export interface TestStore<T> extends SettingsStorelike<T> {
	currentSettings: T;
}

/**
 * Minimal in-memory `SettingsStorelike<T>` for React-side tests. Matches the
 * contract real plugin stores expose (`settings$` BehaviorSubject +
 * async `updateSettings`) without any Obsidian dependencies.
 */
export function makeStore<T>(initial: T): TestStore<T> {
	const settings$ = new BehaviorSubject<T>(initial);
	return {
		settings$,
		get currentSettings() {
			return settings$.getValue();
		},
		updateSettings: async (updater) => {
			settings$.next(updater(settings$.getValue()));
		},
	};
}
