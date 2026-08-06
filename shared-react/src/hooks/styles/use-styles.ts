import { injectStyleSheet } from "@real1ty/obsidian-plugins";
import { useEffect } from "react";

import { useOwnerDocument, useScoped, type ScopedTheme } from "../../contexts/theme-context";

/**
 * Adopt a stylesheet into the mount document once per id on mount. Idempotent —
 * safe to call from multiple components referencing the same id. Targets the
 * document the surrounding mount bridge rendered into, so components styled
 * this way keep working in pop-out windows (settings window, popped-out leaves).
 *
 * Used by React ports of imperative DSLs so they carry their own baseline
 * styling and don't depend on the imperative component being rendered first.
 */
export function useInjectedStyles(id: string, css: string): void {
	const ownerDocument = useOwnerDocument();
	useEffect(() => {
		injectStyleSheet(id, css, ownerDocument);
	}, [id, css, ownerDocument]);
}

/**
 * Combines `useScoped` + `useInjectedStyles` into one call. Resolves the
 * `cssPrefix` from context, runs `buildStyles(cssPrefix)` to produce the
 * stylesheet, injects it under id `${cssPrefix}${scope}-styles`, and returns
 * the same `{ cls, tid, cssPrefix }` triple as `useScoped(scope)`.
 *
 * Replaces the boilerplate:
 *   const { cls, tid, cssPrefix } = useScoped("foo");
 *   useInjectedStyles(`${cssPrefix}foo-styles`, buildFooStyles(cssPrefix));
 *
 * With:
 *   const { cls, tid } = useScopedStyles("foo", buildFooStyles);
 */
export function useScopedStyles(scope: string, buildStyles: (cssPrefix: string) => string): ScopedTheme {
	const scoped = useScoped(scope);
	useInjectedStyles(`${scoped.cssPrefix}${scope}-styles`, buildStyles(scoped.cssPrefix));
	return scoped;
}
