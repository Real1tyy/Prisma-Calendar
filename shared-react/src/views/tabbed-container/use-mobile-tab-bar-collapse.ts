import { useCallback, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "../../hooks/dom/use-media-query";
import { MOBILE_MEDIA_QUERY } from "../../responsive";

export interface UseMobileTabBarCollapseOptions {
	/** `sessionStorage` slot the collapse flag is kept in. Namespace it per view. */
	storageKey: string;
	/** Set false to opt out entirely — the hook then always reports expanded. Default: true. */
	enabled?: boolean;
	/** Collapse state for a session that has no stored answer yet. Default: true. */
	defaultCollapsed?: boolean;
}

export interface MobileTabBarCollapse {
	isMobile: boolean;
	collapsed: boolean;
	setCollapsed: (collapsed: boolean) => void;
	toggle: () => void;
}

/**
 * Session-scoped "is the tab bar collapsed?" state for narrow panes.
 *
 * Collapsing is a *mobile* affordance, so above the breakpoint the hook reports
 * expanded and never touches storage — a desktop user who once collapsed a
 * narrow side-dock must not find their full-width bar missing. `sessionStorage`
 * rather than settings because the state is deliberately forgotten on a fresh
 * app start. See [[knowledge-collapsible-mobile-chrome-tab-bar-and-calendar-header]].
 */
export function useMobileTabBarCollapse({
	storageKey,
	enabled = true,
	defaultCollapsed = true,
}: UseMobileTabBarCollapseOptions): MobileTabBarCollapse {
	const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
	const active = enabled && isMobile;

	// Seeded synchronously when the first render is already mobile, so a stored
	// "expanded" doesn't flash as collapsed for a frame before an effect corrects it.
	const [stored, setStored] = useState<boolean>(() =>
		active ? (readSessionFlag(storageKey) ?? defaultCollapsed) : defaultCollapsed
	);

	// Which key the current `stored` value was seeded from — `null` while the pane
	// has never been mobile. Re-seeds when the pane crosses into mobile (rotation,
	// dock resize) or the consumer swaps the key, and only then: a plain
	// `[storageKey]` effect would clobber the user's toggle on every re-render.
	const seededKeyRef = useRef<string | null>(active ? storageKey : null);

	useEffect(() => {
		if (!active || seededKeyRef.current === storageKey) return;
		seededKeyRef.current = storageKey;
		setStored(readSessionFlag(storageKey) ?? defaultCollapsed);
	}, [active, storageKey, defaultCollapsed]);

	const setCollapsed = useCallback(
		(collapsed: boolean) => {
			setStored(collapsed);
			if (active) writeSessionFlag(storageKey, collapsed);
		},
		[active, storageKey]
	);

	const toggle = useCallback(() => setCollapsed(!stored), [setCollapsed, stored]);

	return { isMobile, collapsed: active && stored, setCollapsed, toggle };
}

/**
 * `sessionStorage` access is wrapped because it *throws* rather than returning
 * null under a private-mode / restricted-storage renderer (Obsidian mobile is
 * one). A tab bar must never take the view down over a cached boolean, so a
 * throwing store degrades to the hook's in-memory state.
 */
function readSessionFlag(key: string): boolean | null {
	try {
		const raw = getSessionStorage()?.getItem(key);
		if (raw === "true") return true;
		if (raw === "false") return false;
		return null;
	} catch {
		return null;
	}
}

function writeSessionFlag(key: string, value: boolean): void {
	try {
		getSessionStorage()?.setItem(key, String(value));
	} catch {
		// Intentionally swallowed — see readSessionFlag.
	}
}

/**
 * `lib.dom` types `window.sessionStorage` as always present, but it is absent
 * under SSR and in test envs that don't implement it — read it through a
 * nullable lens so the runtime guard stays honest instead of being optimised
 * away by `no-unnecessary-condition`. (Same shape as `getMatchMedia` in
 * `use-media-query`.)
 */
function getSessionStorage(): Storage | undefined {
	if (typeof window === "undefined") return undefined;
	const win = window as { sessionStorage?: Storage };
	return win.sessionStorage;
}
