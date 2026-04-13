import type { App } from "obsidian";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { AppContext } from "./contexts/app-context";

export function renderReactInline(container: HTMLElement, content: ReactNode, app: App): () => void {
	const root: Root = createRoot(container);
	root.render(
		<StrictMode>
			<AppContext value={app}>{content}</AppContext>
		</StrictMode>
	);

	return () => {
		root.unmount();
	};
}
