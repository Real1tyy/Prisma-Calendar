import type { App } from "obsidian";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { AppContext } from "./contexts/app-context";
import { SharedReactThemeProvider } from "./contexts/theme-context";

export interface RenderReactInlineOptions {
	/** CSS prefix shared by the rendered subtree. */
	cssPrefix?: string | undefined;
	/** TestId prefix shared by the rendered subtree. */
	testIdPrefix?: string | undefined;
}

export function renderReactInline(
	container: HTMLElement,
	content: ReactNode,
	app: App,
	options?: RenderReactInlineOptions
): () => void {
	const root: Root = createRoot(container);
	root.render(
		<StrictMode>
			<AppContext value={app}>
				<SharedReactThemeProvider cssPrefix={options?.cssPrefix} testIdPrefix={options?.testIdPrefix}>
					{content}
				</SharedReactThemeProvider>
			</AppContext>
		</StrictMode>
	);

	return () => {
		root.unmount();
	};
}
