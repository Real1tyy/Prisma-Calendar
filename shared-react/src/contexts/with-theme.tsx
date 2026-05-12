import type { ComponentType } from "react";
import { useMemo } from "react";

import { useResolvedCssPrefix, useResolvedTestIdPrefix } from "./theme-context";

/**
 * Props the theming HOC injects. Any wrapped component that needs CSS prefix
 * helpers or auto-stamped testid helpers receives them via these props; the
 * caller does not pass them.
 */
export interface ThemedProps {
	cssPrefix: string;
	testIdPrefix: string | undefined;
	/** `cls("foo")` → `${cssPrefix}foo`. `cls("foo", id)` → `${cssPrefix}foo-${id}`. */
	cls: (suffix: string, ...parts: string[]) => string;
	/** `tid("foo", id)` → `${testIdPrefix}foo-${id}` or `undefined`. */
	tid: (suffix: string, ...parts: string[]) => string | undefined;
}

/** Props the caller may still override the auto-injected values with. */
export interface ThemeOverrideProps {
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
}

function joinParts(parts: readonly string[]): string {
	if (parts.length === 0) return "";
	if (parts.length === 1) return `-${parts[0]}`;
	return `-${parts.join("-")}`;
}

function makeCls(cssPrefix: string): (suffix: string, ...parts: string[]) => string {
	return (suffix, ...parts) => `${cssPrefix}${suffix}${joinParts(parts)}`;
}

function makeTid(testIdPrefix: string | undefined): (suffix: string, ...parts: string[]) => string | undefined {
	if (testIdPrefix === undefined) return () => undefined;
	return (suffix, ...parts) => `${testIdPrefix}${suffix}${joinParts(parts)}`;
}

/**
 * Wrap a component so it receives `cssPrefix` / `testIdPrefix` / `cls` / `tid`
 * from the active `SharedReactThemeProvider`. Callers may still pass the prefix
 * props to override the context value — preserves backwards compatibility for
 * any consumer that has not yet wired up a provider.
 *
 * ```tsx
 * const ManagerRow = withTheme(function ManagerRow({ cls, tid, item }: ThemedProps & { item: Item }) {
 *   return <div className={cls("row")} data-testid={tid("row", item.id)} />;
 * });
 * ```
 */
export function withTheme<TProps extends ThemedProps>(
	Component: ComponentType<TProps>
): ComponentType<Omit<TProps, keyof ThemedProps> & ThemeOverrideProps> {
	type OuterProps = Omit<TProps, keyof ThemedProps> & ThemeOverrideProps;

	function Themed(props: OuterProps) {
		const {
			cssPrefix: cssPrefixOverride,
			testIdPrefix: testIdPrefixOverride,
			...rest
		} = props as OuterProps & {
			cssPrefix?: string;
			testIdPrefix?: string;
		};
		const cssPrefix = useResolvedCssPrefix(cssPrefixOverride);
		const testIdPrefix = useResolvedTestIdPrefix(testIdPrefixOverride);
		const cls = useMemo(() => makeCls(cssPrefix), [cssPrefix]);
		const tid = useMemo(() => makeTid(testIdPrefix), [testIdPrefix]);
		const injected = { cssPrefix, testIdPrefix, cls, tid } as ThemedProps;
		return <Component {...(rest as unknown as TProps)} {...injected} />;
	}

	const baseName = Component.displayName ?? Component.name ?? "Component";
	Themed.displayName = `withTheme(${baseName})`;
	return Themed;
}

/**
 * Hook flavour of the same idea — use inside function components that need the
 * full themed bundle without wrapping. Mirrors {@link ThemedProps}.
 */
export function useThemed(overrides?: ThemeOverrideProps): ThemedProps {
	const cssPrefix = useResolvedCssPrefix(overrides?.cssPrefix);
	const testIdPrefix = useResolvedTestIdPrefix(overrides?.testIdPrefix);
	const cls = useMemo(() => makeCls(cssPrefix), [cssPrefix]);
	const tid = useMemo(() => makeTid(testIdPrefix), [testIdPrefix]);
	return { cssPrefix, testIdPrefix, cls, tid };
}
