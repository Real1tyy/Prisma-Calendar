import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";

import { SharedReactThemeProvider } from "../../src/contexts/theme-context";

type UserEventOptions = Parameters<typeof userEvent.setup>[0];

export interface RenderReactResult extends RenderResult {
	user: ReturnType<typeof userEvent.setup>;
}

export interface RenderReactExtras {
	/**
	 * CSS prefix wired into the default theme provider. Defaults to `""` so
	 * unscoped components emit bare class names — matches the prior helper's
	 * behaviour. Pass an explicit prefix when a test needs cls()/tid() output.
	 */
	cssPrefix?: string | undefined;
	/**
	 * TestId prefix wired into the default theme provider. Defaults to `""`
	 * (empty string) so `tid()` actually emits attributes (matches the prior
	 * behaviour where leaves emitted bare `data-testid="foo"` strings).
	 */
	testIdPrefix?: string | undefined;
}

/**
 * `renderReact` wraps the tree in a `SharedReactThemeProvider` so components
 * that read `useCssPrefix` / `useTestIdPrefix` resolve to a known value during
 * tests. Pass `extras.cssPrefix` / `extras.testIdPrefix` when a spec wants
 * specific output (matches what plugins pass at mount-time in production).
 *
 * Uses RTL's `wrapper` option so `rerender()` preserves the theme provider.
 */
export function renderReact(
	ui: ReactElement,
	options?: RenderOptions,
	userEventOptions?: UserEventOptions,
	extras?: RenderReactExtras
): RenderReactResult {
	const user = userEvent.setup(userEventOptions);
	const cssPrefix = extras?.cssPrefix ?? "";
	const testIdPrefix = extras?.testIdPrefix ?? "";
	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<SharedReactThemeProvider cssPrefix={cssPrefix} testIdPrefix={testIdPrefix}>
				{children}
			</SharedReactThemeProvider>
		);
	}
	return { user, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/**
 * Shortcut for the common "render with a specific cssPrefix + testIdPrefix"
 * pattern. Equivalent to passing the prefixes via `renderReact`'s `extras`.
 */
export function renderWithTheme(
	ui: ReactElement,
	prefix: string,
	options?: RenderOptions,
	userEventOptions?: UserEventOptions
): RenderReactResult {
	return renderReact(ui, options, userEventOptions, { cssPrefix: prefix, testIdPrefix: prefix });
}
