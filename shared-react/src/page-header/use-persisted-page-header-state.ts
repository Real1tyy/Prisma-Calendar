import { useCallback, useMemo, useState } from "react";

import { useSchemaField, type SettingsStorelike } from "../hooks/settings/use-schema-field";
import type { PageHeaderState } from "./types";

export interface PersistedPageHeaderState {
	/** Snapshot captured once on mount — safe to pass to `createPageHeader({ initialState })`. */
	initialState: PageHeaderState;
	/** Persist a structural mutation back to the settings store. Wire to `createPageHeader({ onStateChange })`. */
	onStateChange: (next: PageHeaderState) => void;
}

/**
 * Bind a `createPageHeader(...)` call to a settings-store field declared via
 * `pageHeaderField(...)`. Same shape as `usePersistedGridState`. Useful when
 * the page header is instantiated from inside a React effect — the hook gives
 * the effect a stable `initialState` (frozen on mount) plus a memoized
 * `onStateChange` so the effect's dependency array stays small.
 */
export function usePersistedPageHeaderState(store: SettingsStorelike, path: string): PersistedPageHeaderState {
	const [saved, setSaved] = useSchemaField<PageHeaderState>(store, path);
	const [initialState] = useState<PageHeaderState>(() => saved);
	const onStateChange = useCallback((next: PageHeaderState) => setSaved(next), [setSaved]);
	return useMemo(() => ({ initialState, onStateChange }), [initialState, onStateChange]);
}
