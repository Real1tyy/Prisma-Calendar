import { injectStyleSheet } from "@real1ty-obsidian-plugins";
import { useEffect } from "react";

import { useScoped, type ScopedTheme } from "../../contexts/theme-context";

/**
 * Inject a stylesheet into `document.head` once per id on mount. Idempotent —
 * safe to call from multiple components referencing the same id.
 *
 * Used by React ports of imperative DSLs so they carry their own baseline
 * styling and don't depend on the imperative component being rendered first.
 */
export function useInjectedStyles(id: string, css: string): void {
	useEffect(() => {
		injectStyleSheet(id, css);
	}, [id, css]);
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
