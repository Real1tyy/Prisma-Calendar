import { useCallback, useMemo } from "react";

import { getNestedValue, setNestedValue } from "../../core/settings/schema-navigation";
import { type SnapshotSubscribable, useExternalSnapshot } from "./use-external-snapshot";
import type { SettingsStorelike as BaseSettingsStorelike } from "./use-settings-store";

/**
 * Looser structural type so schema-driven primitives don't force consumers'
 * invariant settings generics into a single concrete shape. Field values are
 * unknown at this layer; the schema carries the real types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsStorelike<T = any> = BaseSettingsStorelike<T>;

export interface SchemaFieldBinding<V> {
	value: V;
	onChange: (next: V) => void;
}

/**
 * Build a `SnapshotSubscribable` that reads/subscribes to ONE dotted-path
 * field. The subscription filter only forwards emissions when the path's value
 * reference actually changed — so sibling-field updates don't trigger
 * re-renders of consumers bound to this path.
 *
 * Extracted from `useSchemaField` for testability without a React runtime.
 */
export function pathFilteredSnapshot<V>(store: SettingsStorelike, path: string): SnapshotSubscribable<V> {
	return {
		getValue: () => getNestedValue(store.settings$.getValue(), path) as V,
		subscribe(listener) {
			let last = getNestedValue(store.settings$.getValue(), path);
			const sub = store.settings$.subscribe((settings) => {
				const next = getNestedValue(settings, path);
				if (next !== last) {
					last = next;
					listener();
				}
			});
			return { unsubscribe: () => sub.unsubscribe() };
		},
	};
}

/**
 * Subscribe to ONE dotted-path field on a settings store.
 *
 * Unlike `useSettingsStore` (which re-reads the entire snapshot), this only
 * calls the React listener when the specific field's reference changes. That
 * matters when a section renders 30+ `<SchemaField>` children against the same
 * store — editing one field would otherwise re-render all of them.
 */
export function useSchemaField<V>(store: SettingsStorelike, path: string): SchemaFieldBinding<V> {
	const source = useMemo(() => pathFilteredSnapshot<V>(store, path), [store, path]);
	const value = useExternalSnapshot(source);

	const onChange = useCallback(
		(next: V) => {
			void store.updateSettings((s) => setNestedValue(s, path, next));
		},
		[store, path]
	);

	return { value, onChange };
}
