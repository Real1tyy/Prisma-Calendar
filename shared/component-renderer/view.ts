import { ItemView, type Plugin, type WorkspaceLeaf } from "obsidian";

import { activateView, type LeafPlacement } from "../activate-view";
import type { ViewActivator, ViewComponentConfig, ViewContext } from "./types";

export function registerComponentView(plugin: Plugin, config: ViewComponentConfig): ViewActivator {
	// config is captured by closure — avoids the super() ordering problem
	// where Obsidian's ItemView constructor calls getViewType() before
	// instance fields are assigned
	class ComponentView extends ItemView {
		constructor(leaf: WorkspaceLeaf) {
			super(leaf);
		}

		getViewType(): string {
			return config.viewType;
		}

		getDisplayText(): string {
			return config.displayText;
		}

		getIcon(): string {
			return config.icon ?? "layout";
		}

		async onOpen(): Promise<void> {
			const headerEl = this.containerEl.children[0] as HTMLElement;
			const root = this.containerEl.children[1] as HTMLElement;
			root.empty();
			root.addClass(config.cls);

			const ctx: ViewContext = {
				type: "view",
				app: this.app,
				close: () => this.leaf.detach(),
				leaf: this.leaf,
				headerEl,
			};

			await config.render(root, ctx);
		}

		async onClose(): Promise<void> {
			config.cleanup?.();
		}
	}

	plugin.registerView(config.viewType, (leaf) => new ComponentView(leaf));

	return (placement: LeafPlacement = "tab") =>
		activateView(plugin.app.workspace, {
			viewType: config.viewType,
			placement,
		});
}
