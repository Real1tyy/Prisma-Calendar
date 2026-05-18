import { useCallback, useMemo, useState } from "react";

import { useSchemaField, type SettingsStorelike } from "../../hooks/settings/use-schema-field";
import type { TabbedContainerState } from "./types";

export interface PersistedTabbedContainerState {
	/** Snapshot captured once on mount — safe to pass to `<TabbedContainer initialState>`. */
	initialState: TabbedContainerState;
	/** Persist a structural mutation back to the settings store. Wire to `<TabbedContainer onStateChange>`. */
	onStateChange: (next: TabbedContainerState) => void;
}

/**
 * Bind a `<TabbedContainer>` to a settings-store field declared via
 * `tabbedContainerField(...)`. Same shape and reasoning as
 * `usePersistedGridState` — the schema owns the default, the hook owns the
 * read / persist wiring, and `useState`-freezing prevents the engine from
 * tearing down when the parent re-renders.
 */
export function usePersistedTabbedContainerState(
	store: SettingsStorelike,
	path: string
): PersistedTabbedContainerState {
	const [saved, setSaved] = useSchemaField<TabbedContainerState>(store, path);
	const [initialState] = useState<TabbedContainerState>(() => saved);
	const onStateChange = useCallback((next: TabbedContainerState) => setSaved(next), [setSaved]);
	return useMemo(() => ({ initialState, onStateChange }), [initialState, onStateChange]);
}
