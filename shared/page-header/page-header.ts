import { type ItemView, type WorkspaceLeaf } from "obsidian";

import { openActionManager } from "./action-manager";
import { injectPageHeaderStyles } from "./styles";
import type { HeaderActionDefinition, PageHeaderConfig, PageHeaderHandle, PageHeaderState } from "./types";

const HIDDEN_CLS = "page-header-original-hidden";

let styleInjected = false;
function ensureHiddenStyle(): void {
	if (styleInjected) return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `.${HIDDEN_CLS} { display: none !important; }`;
	document.head.appendChild(style);
}

interface AppliedLeafState {
	ourButtons: Map<string, HTMLElement>;
	settingsButton: HTMLElement | null;
	savedElements: HTMLElement[];
	observer: MutationObserver | null;
}

function resolveVisibleActions(config: PageHeaderConfig): {
	visibleActions: HeaderActionDefinition[];
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	showSettingsButton: boolean;
} {
	const { actions, initialState } = config;
	const renames = new Map<string, string>();
	const iconOverrides = new Map<string, string>();
	const colorOverrides = new Map<string, string>();

	if (initialState?.renames) {
		for (const [id, label] of Object.entries(initialState.renames)) {
			renames.set(id, label);
		}
	}
	if (initialState?.iconOverrides) {
		for (const [id, icon] of Object.entries(initialState.iconOverrides)) {
			iconOverrides.set(id, icon);
		}
	}
	if (initialState?.colorOverrides) {
		for (const [id, color] of Object.entries(initialState.colorOverrides)) {
			colorOverrides.set(id, color);
		}
	}

	const showSettingsButton = initialState?.showSettingsButton !== false;

	if (!initialState?.visibleActionIds) {
		return { visibleActions: actions, renames, iconOverrides, colorOverrides, showSettingsButton };
	}

	const actionMap = new Map(actions.map((a) => [a.id, a]));
	const visible: HeaderActionDefinition[] = [];
	for (const id of initialState.visibleActionIds) {
		const action = actionMap.get(id);
		if (action) visible.push(action);
	}

	return {
		visibleActions: visible.length > 0 ? visible : actions,
		renames,
		iconOverrides,
		colorOverrides,
		showSettingsButton,
	};
}

function discoverActionsContainer(view: ItemView): HTMLElement | null {
	const probe = view.addAction("dot", "", () => {});
	const container = probe.parentElement;
	probe.remove();
	return container;
}

function hideElement(el: HTMLElement): void {
	el.classList.add(HIDDEN_CLS);
}

function unhideElement(el: HTMLElement): void {
	el.classList.remove(HIDDEN_CLS);
}

function applyColorToElement(el: HTMLElement, color: string): void {
	el.style.setProperty("color", color);
}

export function createPageHeader(config: PageHeaderConfig): PageHeaderHandle {
	ensureHiddenStyle();
	injectPageHeaderStyles(config.cssPrefix);
	const { app, onStateChange, editable, mode = "override" } = config;
	const allActions = config.actions;
	const buttonCls = `${config.cssPrefix}header-btn`;
	const settingsBtnCls = `${config.cssPrefix}header-settings`;

	const resolved = resolveVisibleActions(config);
	let visibleActions = [...resolved.visibleActions];
	const renames = resolved.renames;
	const iconOverrides = resolved.iconOverrides;
	const colorOverrides = resolved.colorOverrides;
	let showSettingsButton = resolved.showSettingsButton;

	const appliedLeaves = new Map<WorkspaceLeaf, AppliedLeafState>();
	let destroyed = false;

	function getLabel(action: HeaderActionDefinition): string {
		return renames.get(action.id) ?? action.label;
	}

	function getIconOverride(action: HeaderActionDefinition): string {
		return iconOverrides.get(action.id) ?? action.icon;
	}

	function getColor(action: HeaderActionDefinition): string | undefined {
		return colorOverrides.get(action.id) ?? action.color;
	}

	const defaultOrder = allActions.map((a) => a.id);

	function buildState(): PageHeaderState {
		const state: PageHeaderState = {};

		if (renames.size > 0) state.renames = Object.fromEntries(renames);
		if (iconOverrides.size > 0) state.iconOverrides = Object.fromEntries(iconOverrides);
		if (colorOverrides.size > 0) state.colorOverrides = Object.fromEntries(colorOverrides);

		const currentOrder = visibleActions.map((a) => a.id);
		if (currentOrder.length !== defaultOrder.length || currentOrder.some((id, i) => id !== defaultOrder[i])) {
			state.visibleActionIds = currentOrder;
		}

		if (!showSettingsButton) state.showSettingsButton = false;

		return state;
	}

	function emitStateChange(): void {
		onStateChange?.(buildState());
	}

	function renderButtons(leaf: WorkspaceLeaf, leafState: AppliedLeafState): void {
		const view = leaf.view as ItemView;

		if (editable && showSettingsButton) {
			const settingsEl = view.addAction("settings-2", "Manage Header Actions", () => {
				showActionManager();
			});
			settingsEl.addClass(buttonCls);
			settingsEl.addClass(settingsBtnCls);
			leafState.settingsButton = settingsEl;
		}

		for (let i = visibleActions.length - 1; i >= 0; i--) {
			const action = visibleActions[i];
			const icon = getIconOverride(action);
			const label = getLabel(action);

			const el = view.addAction(icon, label, () => {
				app.workspace.setActiveLeaf(leaf, { focus: true });
				action.onAction(view);
			});

			el.addClass(buttonCls);
			const color = getColor(action);
			if (color && color !== "#000000") {
				applyColorToElement(el, color);
			}

			leafState.ourButtons.set(action.id, el);
		}
	}

	function hideNonOwnChildren(container: HTMLElement, leafState: AppliedLeafState): void {
		const ownEls = new Set(leafState.ourButtons.values());
		if (leafState.settingsButton) ownEls.add(leafState.settingsButton);
		for (const child of Array.from(container.children) as HTMLElement[]) {
			if (!ownEls.has(child) && !child.classList.contains(HIDDEN_CLS)) {
				leafState.savedElements.push(child);
				hideElement(child);
			}
		}
	}

	function applyToLeaf(leaf: WorkspaceLeaf): void {
		const view = leaf.view as ItemView;
		if (!view || typeof view.addAction !== "function") return;

		removeFromLeaf(leaf);

		const leafState: AppliedLeafState = {
			ourButtons: new Map(),
			settingsButton: null,
			savedElements: [],
			observer: null,
		};
		appliedLeaves.set(leaf, leafState);

		renderButtons(leaf, leafState);

		if (mode === "override") {
			const actionsEl = discoverActionsContainer(view);
			if (actionsEl) {
				hideNonOwnChildren(actionsEl, leafState);

				const observer = new MutationObserver(() => {
					hideNonOwnChildren(actionsEl, leafState);
				});
				observer.observe(actionsEl, { childList: true });
				leafState.observer = observer;
			}
		}
	}

	function removeFromLeaf(leaf: WorkspaceLeaf): void {
		const leafState = appliedLeaves.get(leaf);
		if (!leafState) return;

		leafState.observer?.disconnect();

		for (const el of leafState.ourButtons.values()) {
			el.remove();
		}
		leafState.settingsButton?.remove();

		for (const el of leafState.savedElements) {
			unhideElement(el);
		}

		appliedLeaves.delete(leaf);
	}

	function refreshAll(): void {
		for (const leaf of [...appliedLeaves.keys()]) {
			applyToLeaf(leaf);
		}
	}

	function hideAction(id: string): void {
		if (visibleActions.length <= 1) return;
		visibleActions = visibleActions.filter((a) => a.id !== id);
		emitStateChange();
		refreshAll();
	}

	function restoreAction(id: string): void {
		const action = allActions.find((a) => a.id === id);
		if (!action || visibleActions.find((a) => a.id === id)) return;
		visibleActions = [...visibleActions, action];
		emitStateChange();
		refreshAll();
	}

	function moveAction(id: string, direction: -1 | 1): void {
		const idx = visibleActions.findIndex((a) => a.id === id);
		const newIdx = idx + direction;
		if (idx < 0 || newIdx < 0 || newIdx >= visibleActions.length) return;

		const updated = [...visibleActions];
		[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
		visibleActions = updated;

		emitStateChange();
		refreshAll();
	}

	function showActionManager(): void {
		if (!editable) return;

		openActionManager({
			app,
			cssPrefix: config.cssPrefix,
			allActions,
			getVisibleActions: () => visibleActions,
			renames,
			iconOverrides,
			colorOverrides,
			showSettingsButton,
			onHide: hideAction,
			onRestore: restoreAction,
			onMove: moveAction,
			onRename: (id, label) => {
				if (label) {
					const action = allActions.find((a) => a.id === id);
					if (action && label !== action.label) {
						renames.set(id, label);
					} else {
						renames.delete(id);
					}
				} else {
					renames.delete(id);
				}
				emitStateChange();
				refreshAll();
			},
			onIconChange: (id, icon) => {
				if (icon) {
					const action = allActions.find((a) => a.id === id);
					if (action && icon !== action.icon) {
						iconOverrides.set(id, icon);
					} else {
						iconOverrides.delete(id);
					}
				} else {
					iconOverrides.delete(id);
				}
				emitStateChange();
				refreshAll();
			},
			onColorChange: (id, color) => {
				if (color) {
					colorOverrides.set(id, color);
				} else {
					colorOverrides.delete(id);
				}
				emitStateChange();
				refreshAll();
			},
			onToggleSettingsButton: (visible) => {
				showSettingsButton = visible;
				emitStateChange();
				refreshAll();
			},
		});
	}

	function cleanup(): void {
		if (destroyed) return;
		destroyed = true;
		for (const leaf of [...appliedLeaves.keys()]) {
			removeFromLeaf(leaf);
		}
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
			hideAction(id);
		},

		restoreAction(id: string): void {
			if (destroyed) return;
			restoreAction(id);
		},

		moveAction(id: string, direction: -1 | 1): void {
			if (destroyed) return;
			moveAction(id, direction);
		},

		showActionManager(): void {
			if (destroyed) return;
			showActionManager();
		},

		getState(): PageHeaderState {
			return buildState();
		},

		get visibleCount(): number {
			return visibleActions.length;
		},

		destroy(): void {
			cleanup();
		},
	};

	return handle;
}
