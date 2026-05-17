import { getNestedValue, setNestedValue } from "@real1ty-obsidian-plugins";
import { useCallback, useMemo } from "react";

import { type SnapshotSubscribable, useExternalSnapshot } from "../reactive/use-external-snapshot";
import type { Paths, PathValue } from "./path-types";
import type { SettingsStorelike as BaseSettingsStorelike } from "./use-settings-store";

/**
 * Looser structural type so schema-driven primitives don't force consumers'
 * invariant settings generics into a single concrete shape. Field values are
 * unknown at this layer; the schema carries the real types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsStorelike<T = any> = BaseSettingsStorelike<T>;

/**
 * Setter accepts either a direct value OR an updater function that receives
 * the previous value — same shape as React's `useState`. The updater form
 * sees the latest store snapshot (not the closed-over render value), so it's
 * safe for array/computed updates.
 *
 * Inherits React's `useState` ambiguity: if `V` itself is a function type,
 * passing a function is interpreted as an updater, not a stored value. This
 * is a non-issue for settings — fields must round-trip through JSON, so
 * function-valued settings are already forbidden.
 */
export type SchemaFieldSetter<V> = (next: V | ((prev: V) => V)) => void;

/**
 * Dual-shape binding: destructures as a `[value, setter]` tuple (matching
 * `useState`) and also exposes named `.value` / `.onChange` properties for
 * spread-friendly callers like `<SchemaField {...binding} />`. The runtime
 * value is an array with the two named properties attached via `Object.assign`.
 */
export type SchemaFieldBinding<V> = readonly [V, SchemaFieldSetter<V>] & {
	readonly value: V;
	readonly onChange: SchemaFieldSetter<V>;
};

function makeBinding<V>(value: V, onChange: SchemaFieldSetter<V>): SchemaFieldBinding<V> {
	const tuple = [value, onChange] as [V, SchemaFieldSetter<V>];
	return Object.assign(tuple, { value, onChange }) as SchemaFieldBinding<V>;
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
 *
 * Two call styles:
 *
 * - **Typed**: `useSchemaField(store, "holidays.enabled")` infers the value
 *   type from the store's settings shape. Use when the store's generic is
 *   known at the call site.
 * - **Loose**: `useSchemaField<V>(store, runtimePath)` accepts any string
 *   path with an explicit `V`. Use when the path comes from runtime data
 *   (e.g., a schema descriptor key).
 */
export function useSchemaField<S extends object, P extends Paths<S> & string>(
	store: BaseSettingsStorelike<S>,
	path: P
): SchemaFieldBinding<PathValue<S, P>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSchemaField<V>(store: SettingsStorelike<any>, path: string): SchemaFieldBinding<V>;
export function useSchemaField<V>(store: SettingsStorelike, path: string): SchemaFieldBinding<V> {
	const source = useMemo(() => pathFilteredSnapshot<V>(store, path), [store, path]);
	const value = useExternalSnapshot(source);

	const onChange = useCallback<SchemaFieldSetter<V>>(
		(next) => {
			void store.updateSettings((s) => {
				const resolved = typeof next === "function" ? (next as (prev: V) => V)(getNestedValue(s, path) as V) : next;
				return setNestedValue(s, path, resolved);
			});
		},
		[store, path]
	);

	return useMemo(() => makeBinding(value, onChange), [value, onChange]);
}
