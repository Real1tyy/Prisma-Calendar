import type { ScopedTheme } from "../contexts/theme-context";
import { useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "./use-injected-styles";

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
