import { injectStyleSheet } from "@real1ty-obsidian-plugins";
import type { ItemView, WorkspaceLeaf } from "obsidian";

import { renderReactInline } from "../react-inline";
import { PageHeaderActionBar } from "./action-bar";
import { openPageHeaderActionManager } from "./action-manager";
import { PageHeaderStore } from "./store";
import { buildPageHeaderStyles } from "./styles";
import type { PageHeaderConfig, PageHeaderHandle, PageHeaderState } from "./types";

const HIDDEN_CLS = "page-header-original-hidden";
const HOST_CLS_SUFFIX = "page-header-host";
const HIDDEN_STYLE_ID = "page-header-hidden-cls";

function ensureHiddenStyle(): void {
	injectStyleSheet(HIDDEN_STYLE_ID, `.${HIDDEN_CLS} { display: none !important; }`);
}

interface AppliedLeafState {
	host: HTMLElement;
	unmount: () => void;
	savedElements: HTMLElement[];
	observer: MutationObserver | null;
	container: HTMLElement | null;
}

function discoverActionsContainer(view: ItemView): HTMLElement | null {
	const probe = view.addAction("dot", "", () => {});
	const container = probe.parentElement;
	probe.remove();
	return container;
}

export function createPageHeader(config: PageHeaderConfig): PageHeaderHandle {
	ensureHiddenStyle();
	injectStyleSheet(`${config.cssPrefix}page-header-styles`, buildPageHeaderStyles(config.cssPrefix));

	const { app, onStateChange, editable = false, mode = "override", cssPrefix } = config;
	const store = new PageHeaderStore(config.actions, config.initialState);
	const appliedLeaves = new Map<WorkspaceLeaf, AppliedLeafState>();
	let destroyed = false;

	const stateUnsubscribe = store.subscribe(() => {
		if (destroyed) return;
		onStateChange?.(store.serialize());
	}).unsubscribe;

	function hideElement(el: HTMLElement): void {
		el.classList.add(HIDDEN_CLS);
	}

	function unhideElement(el: HTMLElement): void {
		el.classList.remove(HIDDEN_CLS);
	}

	function hideNonHostChildren(container: HTMLElement, hostEl: HTMLElement, leafState: AppliedLeafState): void {
		for (const child of Array.from(container.children) as HTMLElement[]) {
			if (child === hostEl) continue;
			if (child.classList.contains(HIDDEN_CLS)) continue;
			leafState.savedElements.push(child);
			hideElement(child);
		}
	}

	function applyToLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view as ItemView;
		if (typeof view.addAction !== "function") return;

		removeFromLeaf(leaf);

		const container = discoverActionsContainer(view);
		if (!container) return;

		const host = document.createElement("div");
		host.className = `${cssPrefix}${HOST_CLS_SUFFIX}`;
		container.insertBefore(host, container.firstChild);

		const leafState: AppliedLeafState = {
			host,
			unmount: () => {},
			savedElements: [],
			observer: null,
			container,
		};
		appliedLeaves.set(leaf, leafState);

		if (mode === "override") {
			hideNonHostChildren(container, host, leafState);
			const observer = new MutationObserver(() => {
				hideNonHostChildren(container, host, leafState);
			});
			observer.observe(container, { childList: true });
			leafState.observer = observer;
		}

		const unmount = renderReactInline(
			host,
			<PageHeaderActionBar
				store={store}
				cssPrefix={cssPrefix}
				editable={editable}
				onActionClick={(id) => {
					app.workspace.setActiveLeaf(leaf, { focus: true });
					const action = config.actions.find((a) => a.id === id);
					action?.onAction(view);
				}}
				onSettingsClick={() => {
					if (editable) openPageHeaderActionManager(app, store, cssPrefix);
				}}
			/>,
			app
		);
		leafState.unmount = unmount;
	}

	function removeFromLeaf(leaf: WorkspaceLeaf): void {
		const leafState = appliedLeaves.get(leaf);
		if (!leafState) return;

		leafState.observer?.disconnect();
		leafState.unmount();
		leafState.host.remove();
		for (const el of leafState.savedElements) unhideElement(el);
		appliedLeaves.delete(leaf);
	}

	function refreshAll(): void {
		for (const leaf of [...appliedLeaves.keys()]) {
			applyToLeaf(leaf);
		}
	}

	function cleanup(): void {
		if (destroyed) return;
		destroyed = true;
		stateUnsubscribe();
		for (const leaf of [...appliedLeaves.keys()]) removeFromLeaf(leaf);
	}

	const handle: PageHeaderHandle = {
		apply(leaf: WorkspaceLeaf): void {
			if (destroyed) return;
			applyToLeaf(leaf);
		},
		remove(leaf: WorkspaceLeaf): void {
			if (destroyed) return;
			removeFromLeaf(leaf);
		},
		refresh(): void {
			if (destroyed) return;
			refreshAll();
		},
		hideAction(id: string): void {
			if (destroyed) return;
			store.hideAction(id);
		},
		restoreAction(id: string): void {
			if (destroyed) return;
			store.restoreAction(id);
		},
		moveAction(id: string, direction: -1 | 1): void {
			if (destroyed) return;
			store.moveAction(id, direction);
		},
		showActionManager(): void {
			if (destroyed || !editable) return;
			openPageHeaderActionManager(app, store, cssPrefix);
		},
		getState(): PageHeaderState {
			return store.serialize();
		},
		get visibleCount(): number {
			return store.visibleCount;
		},
		destroy(): void {
			cleanup();
		},
	};

	return handle;
}
