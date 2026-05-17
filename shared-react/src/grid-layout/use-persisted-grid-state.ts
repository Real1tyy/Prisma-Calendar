import { useCallback, useMemo, useState } from "react";

import { type SettingsStorelike, useSchemaField } from "../hooks/settings/use-schema-field";
import { type GridLayoutState, gridStateField, type GridStateFieldDefaults } from "./types";

export interface PersistedGridState {
	/** Snapshot captured once on mount — safe to pass to `<GridLayout initialState>`. */
	initialState: GridLayoutState;
	/** Persist a structural mutation back to the settings store. Wire to `<GridLayout onStateChange>`. */
	onStateChange: (next: GridLayoutState) => void;
}

/**
 * Bind a `<GridLayout>` to a settings-store field that already declares its
 * default via `gridStateField({...})` on the schema side. Pairs the two so the
 * tab file no longer hand-rolls `useSchemaField` + `useState` initializer +
 * `useCallback` setter for every persisted grid.
 *
 * The settings field MUST resolve to a non-optional `GridLayoutState` — i.e.
 * the schema uses `gridStateField(...)` (which applies `.default()`), not a
 * bare `GridLayoutStateSchema.optional()`. That guarantee is what lets the
 * hook drop the `?? FALLBACK` ceremony at every call site.
 */
export function usePersistedGridState(store: SettingsStorelike, path: string): PersistedGridState {
	const [saved, setSaved] = useSchemaField<GridLayoutState>(store, path);
	// useState initializer runs once: this freezes the prop reference so
	// <GridLayout> doesn't see a new `initialState` object on every parent
	// re-render and tear the engine down.
	const [initialState] = useState<GridLayoutState>(() => saved);
	const onStateChange = useCallback((next: GridLayoutState) => setSaved(next), [setSaved]);
	// Memo the returned object so callers can put the whole bundle in effect
	// deps (e.g. createPageHeader-in-useEffect patterns) without re-running on
	// every parent render. Both inner fields are already stable.
	return useMemo(() => ({ initialState, onStateChange }), [initialState, onStateChange]);
}

/**
 * Record-keyed variant of `usePersistedGridState`. Use when a single settings
 * field holds multiple sibling grids keyed by an in-tab id — e.g. the
 * dashboard's by-name / by-category / recurring sections all live under one
 * `dashboardGridState: Record<string, GridLayoutState>` schema entry.
 *
 * `defaults` seeds the slot when this `id` has never been persisted (the
 * schema can't carry per-id defaults because every section uses the same
 * shape). `onStateChange` shallow-merges into the existing record so
 * unrelated ids are preserved across writes.
 */
export function usePersistedGridStateById(
	store: SettingsStorelike,
	path: string,
	id: string,
	defaults: GridStateFieldDefaults
): PersistedGridState {
	const [savedRecord, setRecord] = useSchemaField<Record<string, GridLayoutState>>(store, path);
	// Parse undefined through the same field helper the schema side uses, so
	// the seed is structurally identical to a value loaded from disk on a
	// later session — no shape drift between "first render" and "after reload".
	const [initialState] = useState<GridLayoutState>(() => savedRecord[id] ?? gridStateField(defaults).parse(undefined));
	const onStateChange = useCallback(
		(next: GridLayoutState) => {
			setRecord((prev) => ({ ...prev, [id]: next }));
		},
		[id, setRecord]
	);
	return useMemo(() => ({ initialState, onStateChange }), [initialState, onStateChange]);
}
