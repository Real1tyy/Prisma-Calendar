import { useCallback, useMemo } from "react";

import { type SnapshotSubscribable, useExternalSnapshot } from "../reactive/use-external-snapshot";
import type { SettingsStorelike } from "./use-settings-store";

/**
 * Settings keys are always string-typed in Zod-parsed schemas — symbol and
 * numeric keys would break JSON round-tripping. Constraining `K` here makes
 * the keysKey serializer safe and gives better inference at call sites.
 */
export type SettingsFieldsPatch<S, K extends keyof S & string> = Partial<Pick<S, K>>;
export type SettingsFieldsUpdater<S, K extends keyof S & string> = (
	patch: SettingsFieldsPatch<S, K> | ((prev: Pick<S, K>) => SettingsFieldsPatch<S, K>)
) => Promise<void>;

/**
 * Build a `SnapshotSubscribable` that emits a stable `Pick<S, K>` projection
 * of the store's settings. The projection is identity-equal across emissions
 * as long as every listed key's value reference is unchanged — so consumers
 * only re-render when one of the selected keys actually moves.
 *
 * Extracted for testability without a React runtime.
 */
export function fieldsFilteredSnapshot<S extends object, K extends keyof S & string>(
	store: SettingsStorelike<S>,
	keys: readonly K[]
): SnapshotSubscribable<Pick<S, K>> {
	const project = (settings: S): Pick<S, K> => {
		const out = {} as Pick<S, K>;
		for (const key of keys) out[key] = settings[key];
		return out;
	};

	let cachedSource = store.settings$.getValue();
	let cachedProjection = project(cachedSource);

	const readProjection = (): Pick<S, K> => {
		const current = store.settings$.getValue();
		if (current === cachedSource) return cachedProjection;
		const next = project(current);
		const same = keys.every((k) => cachedProjection[k] === next[k]);
		cachedSource = current;
		if (!same) cachedProjection = next;
		return cachedProjection;
	};

	return {
		getValue: readProjection,
		subscribe(listener) {
			let last = readProjection();
			const sub = store.settings$.subscribe(() => {
				const next = readProjection();
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
 * Separator used when serialising key arrays into a stable string for
 * `useMemo` deps. NUL never appears in a JS identifier (settings keys are
 * identifier-like in our schemas), so it's collision-proof — unlike `|`,
 * which can in principle appear in arbitrary keys.
 */
const KEYS_KEY_SEPARATOR = "\u0000";

/**
 * Subscribe to a subset of top-level fields on a settings store.
 *
 * Returns `[projection, updatePatch]`:
 *
 * - `projection` is `Pick<S, K>` — a stable object that only changes
 *   reference when one of the listed keys' values changes.
 * - `updatePatch(patch)` merges a partial subset over current settings via
 *   `store.updateSettings`. Pass an object to set fields directly, or a
 *   function `(prev) => patch` to compute the patch from the latest store
 *   snapshot (safe for concurrent/async writes).
 *
 * Use this when a component reads/writes a small named subset of settings.
 * For a single field, prefer `useSchemaField`. For the entire snapshot, use
 * `useSettingsStore`.
 *
 * `const K extends readonly (keyof S & string)[]` preserves literal types
 * on inline array arguments, so `useSettingsFields(store, ["locale", "tz"])`
 * narrows `K[number]` to `"locale" | "tz"` without an `as const` at the
 * call site.
 */
export function useSettingsFields<S extends object, const K extends readonly (keyof S & string)[]>(
	store: SettingsStorelike<S>,
	keys: K
): [Pick<S, K[number]>, SettingsFieldsUpdater<S, K[number]>] {
	// `keys` is a new array reference per render; useMemo on `[keys]` would
	// invalidate every render anyway. Compute the stable string inline, then
	// let downstream hooks depend on the primitive.
	const keysKey = [...keys].sort().join(KEYS_KEY_SEPARATOR);

	const source = useMemo(
		() => fieldsFilteredSnapshot<S, K[number]>(store, keys),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[store, keysKey]
	);
	const projection = useExternalSnapshot(source);

	const update = useCallback<SettingsFieldsUpdater<S, K[number]>>(
		(patch) =>
			store.updateSettings((s) => {
				if (typeof patch !== "function") return { ...s, ...patch };
				const prev = {} as Pick<S, K[number]>;
				for (const key of keys) prev[key] = s[key];
				return { ...s, ...patch(prev) };
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[store, keysKey]
	);

	return [projection, update];
}
