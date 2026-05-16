import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

export interface SharedReactTheme {
	/**
	 * Plugin CSS prefix (e.g. `"prisma-"`). Trailing `-` is part of the prefix
	 * per `docs/decisions/2026-04-12-css-prefix-convention.md` and components
	 * concatenate suffixes directly (`${cssPrefix}foo`).
	 */
	cssPrefix: string;
	/**
	 * Prefix prepended to every auto-stamped `data-testid`. Pass `""` for the
	 * "emit testids without a prefix" mode (used by shared plugin-agnostic
	 * modals such as `confirmation-modal`).
	 */
	testIdPrefix: string;
}

const DEFAULT_THEME: SharedReactTheme = { cssPrefix: "", testIdPrefix: "" };

const ThemeContext = createContext<SharedReactTheme>(DEFAULT_THEME);

export interface SharedReactThemeProviderProps {
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
	children: ReactNode;
}

/**
 * Scoped theme boundary. Every modal/view mount bridge wraps its subtree in one
 * so leaf components can pull `cssPrefix` / `testIdPrefix` via hooks instead of
 * accepting them as explicit props. Unspecified values inherit from the
 * surrounding theme.
 */
export function SharedReactThemeProvider({ cssPrefix, testIdPrefix, children }: SharedReactThemeProviderProps) {
	const parent = useContext(ThemeContext);
	const value = useMemo<SharedReactTheme>(
		() => ({
			cssPrefix: cssPrefix ?? parent.cssPrefix,
			testIdPrefix: testIdPrefix ?? parent.testIdPrefix,
		}),
		[cssPrefix, testIdPrefix, parent.cssPrefix, parent.testIdPrefix]
	);
	return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): SharedReactTheme {
	return useContext(ThemeContext);
}

export function useCssPrefix(): string {
	return useContext(ThemeContext).cssPrefix;
}

export function useTestIdPrefix(): string {
	return useContext(ThemeContext).testIdPrefix;
}

/**
 * `cls()` returns `${prefix}${scope}`. `cls("foo")` adds `-foo`.
 * Trailing parts are joined with `-`. Empty `scope` means "just the prefix
 * concatenated with the suffix" (matches the unscoped form).
 */
function joinScoped(prefix: string, scope: string, suffix: string, parts: readonly string[]): string {
	const base = scope ? `${prefix}${scope}` : prefix;
	const segments: string[] = [];
	if (suffix) segments.push(suffix);
	for (const p of parts) if (p) segments.push(p);
	if (segments.length === 0) return base;
	return scope ? `${base}-${segments.join("-")}` : `${base}${segments.join("-")}`;
}

/**
 * Class-name factory: `cls("row")` → `${cssPrefix}row`,
 * `cls("row", id)` → `${cssPrefix}row-${id}`. Replaces the local
 * `(s) => \`${cssPrefix}\${s}\`` helpers reinvented in every component.
 */
export function useCls(): (suffix?: string, ...parts: string[]) => string {
	const { cssPrefix } = useContext(ThemeContext);
	return useCallback((suffix = "", ...parts) => joinScoped(cssPrefix, "", suffix, parts), [cssPrefix]);
}

/**
 * TestId factory: `tid("row", id)` → `${testIdPrefix}row-${id}`. Always returns
 * a string — if no prefix is configured the result is `row-${id}` (unprefixed).
 */
export function useTestId(): (suffix?: string, ...parts: string[]) => string {
	const { testIdPrefix } = useContext(ThemeContext);
	return useCallback((suffix = "", ...parts) => joinScoped(testIdPrefix, "", suffix, parts), [testIdPrefix]);
}

/**
 * Scoped variant: `useScopedCls("manager")()` → `${cssPrefix}manager`,
 * `useScopedCls("manager")("row")` → `${cssPrefix}manager-row`. Use inside
 * components that namespace their classes under a per-component prefix
 * (ManagerRow, PageBanner, CollapsibleSection, …) — replaces every
 * `\`${cssPrefix}${rowPrefix}-foo\`` template string with `cls("foo")`.
 */
export function useScopedCls(scope: string): (suffix?: string, ...parts: string[]) => string {
	const { cssPrefix } = useContext(ThemeContext);
	return useCallback((suffix = "", ...parts) => joinScoped(cssPrefix, scope, suffix, parts), [cssPrefix, scope]);
}

/**
 * Scoped testId factory: `useScopedTid("rename")("cancel")` →
 * `${testIdPrefix}rename-cancel`. Always returns a string; the empty-prefix
 * mode produces `rename-cancel` directly.
 */
export function useScopedTid(scope: string): (suffix?: string, ...parts: string[]) => string {
	const { testIdPrefix } = useContext(ThemeContext);
	return useCallback((suffix = "", ...parts) => joinScoped(testIdPrefix, scope, suffix, parts), [testIdPrefix, scope]);
}

export interface ScopedTheme {
	cssPrefix: string;
	cls: (suffix?: string, ...parts: string[]) => string;
	tid: (suffix?: string, ...parts: string[]) => string;
}

/**
 * Bundles the three values that almost always travel together inside a scoped
 * component: the raw `cssPrefix` (for `useInjectedStyles(buildXxxStyles(...))`)
 * plus the same scoped `cls` / `tid` factories `useScopedCls` / `useScopedTid`
 * return. Destructure inline: `const { cls, tid, cssPrefix } = useScoped("foo")`.
 * Omit the scope to get the unscoped form (`cls("row")` → `${cssPrefix}row`).
 */
export function useScoped(scope = ""): ScopedTheme {
	const { cssPrefix, testIdPrefix } = useContext(ThemeContext);
	const cls = useCallback(
		(suffix = "", ...parts: string[]) => joinScoped(cssPrefix, scope, suffix, parts),
		[cssPrefix, scope]
	);
	const tid = useCallback(
		(suffix = "", ...parts: string[]) => joinScoped(testIdPrefix, scope, suffix, parts),
		[testIdPrefix, scope]
	);
	return { cssPrefix, cls, tid };
}

/**
 * Resolve the active CSS prefix with an explicit override winning over context.
 * Use inside components whose public API still accepts the legacy `cssPrefix`
 * prop so callers above any provider keep working.
 */
export function useResolvedCssPrefix(override: string | undefined): string {
	const fromContext = useCssPrefix();
	return override ?? fromContext;
}

/**
 * Resolve the active testId prefix with an explicit override winning over
 * context. Always returns a string ("" is valid and means unprefixed).
 */
export function useResolvedTestIdPrefix(override: string | undefined): string {
	const fromContext = useTestIdPrefix();
	return override ?? fromContext;
}
