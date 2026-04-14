import { activateView, type LeafPlacement } from "@real1ty-obsidian-plugins";
import type { Plugin, WorkspaceLeaf } from "obsidian";
import { ItemView } from "obsidian";
import type { ReactNode, RefCallback } from "react";
import { StrictMode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

import { AppContext } from "./contexts/app-context";

export interface ReactViewHandle {
	[key: string]: (...args: never[]) => unknown;
}

export interface ReactViewConfig<THandle extends ReactViewHandle = ReactViewHandle> {
	viewType: string;
	displayText: string;
	icon?: string;
	cls?: string;
	render: (ref: RefCallback<THandle>) => ReactNode;
}

export function registerReactView<THandle extends ReactViewHandle = ReactViewHandle>(
	plugin: Plugin,
	config: ReactViewConfig<THandle>
): {
	activate: (placement?: LeafPlacement) => Promise<WorkspaceLeaf | null>;
	getHandle: (leaf: WorkspaceLeaf) => THandle | null;
} {
	const handleMap = new WeakMap<WorkspaceLeaf, THandle | null>();

	class ReactView extends ItemView {
		private root: Root | null = null;

		constructor(leaf: WorkspaceLeaf) {
			super(leaf);
		}

		getViewType(): string {
			return config.viewType;
		}

		getDisplayText(): string {
			return config.displayText;
		}

		override getIcon(): string {
			return config.icon ?? "layout";
		}

		override async onOpen(): Promise<void> {
			const container = this.containerEl.children[1] as HTMLElement;
			container.empty();
			if (config.cls) {
				container.addClass(config.cls);
			}

			const setHandle: RefCallback<THandle> = (handle) => {
				handleMap.set(this.leaf, handle);
			};

			this.root = createRoot(container);
			this.root.render(
				<StrictMode>
					<AppContext value={this.app}>{config.render(setHandle)}</AppContext>
				</StrictMode>
			);
		}

		override async onClose(): Promise<void> {
			handleMap.delete(this.leaf);
			this.root?.unmount();
			this.root = null;
		}
	}

	const registry = (plugin.app as any).viewRegistry?.viewByType;
	if (!registry || !registry[config.viewType]) {
		plugin.registerView(config.viewType, (leaf) => new ReactView(leaf));
	}

	return {
		activate: (placement: LeafPlacement = "tab") =>
			activateView(plugin.app.workspace, {
				viewType: config.viewType,
				placement,
			}),
		getHandle: (leaf: WorkspaceLeaf) => handleMap.get(leaf) ?? null,
	};
}
