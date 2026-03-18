import { Menu, setIcon, Setting } from "obsidian";

import { showModal } from "../component-renderer/modal";
import { createCssUtils } from "../core/css-utils";
import { injectTabStyles } from "./styles";
import type { TabbedContainerConfig, TabbedContainerHandle, TabbedContainerState, TabDefinition } from "./types";

function resolveVisibleTabs(config: TabbedContainerConfig): {
	visibleTabs: TabDefinition[];
	renames: Map<string, string>;
} {
	const { tabs, initialState } = config;
	const renames = new Map<string, string>();
	if (initialState?.renames) {
		for (const [id, label] of Object.entries(initialState.renames)) {
			renames.set(id, label);
		}
	}

	if (!initialState?.visibleTabIds) {
		return { visibleTabs: tabs, renames };
	}

	const tabMap = new Map(tabs.map((t) => [t.id, t]));
	const visible: TabDefinition[] = [];
	for (const id of initialState.visibleTabIds) {
		const tab = tabMap.get(id);
		if (tab) visible.push(tab);
	}

	return { visibleTabs: visible.length > 0 ? visible : tabs, renames };
}

export function createTabbedContainer(container: HTMLElement, config: TabbedContainerConfig): TabbedContainerHandle {
	const { cssPrefix, onTabChange, onStateChange, lazy = true, tabBarContainer, tabBarInsertBefore, editable } = config;
	const allTabs = config.tabs;
	const css = createCssUtils(cssPrefix);

	const rendered = new Set<string>();
	injectTabStyles(config.cssPrefix);
	const panelMap = new Map<string, HTMLElement>();

	const { visibleTabs: initialVisible, renames } = resolveVisibleTabs(config);
	let visibleTabs = [...initialVisible];
	let currentIndex = 0;
	let showSettingsButton = config.initialState?.showSettingsButton !== false;
	let destroyed = false;

	const barParent = tabBarContainer ?? container;
	const tabBar = barParent.createDiv(css.cls("tab-bar"));
	if (tabBarInsertBefore && tabBarInsertBefore.parentElement === barParent) {
		barParent.insertBefore(tabBar, tabBarInsertBefore);
	}
	const tabContent = container.createDiv(css.cls("tab-content"));

	let buttons: HTMLElement[] = [];

	let containerActive = false;

	const onPointerDown = (e: PointerEvent): void => {
		const target = e.target as Node;
		containerActive = container.contains(target) || tabBar.contains(target);
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (!containerActive || destroyed) return;
		const tab = visibleTabs[currentIndex];
		const handler = tab?.keyHandlers?.[e.key];
		if (handler) {
			handler(e);
			e.preventDefault();
		}
	};

	document.addEventListener("pointerdown", onPointerDown, true);
	document.addEventListener("keydown", onKeyDown);

	buildPanels();
	renderTabBar();
	activateTab(currentIndex);

	if (!lazy) {
		for (const tab of visibleTabs) {
			renderPanelIfNeeded(tab);
		}
	}

	function getLabel(tab: TabDefinition): string {
		return renames.get(tab.id) ?? tab.label;
	}

	function buildState(): TabbedContainerState {
		const state: TabbedContainerState = {};
		if (renames.size > 0) state.renames = Object.fromEntries(renames);
		const defaultOrder = allTabs.map((t) => t.id);
		const currentOrder = visibleTabs.map((t) => t.id);
		if (visibleTabs.length !== allTabs.length || currentOrder.some((id, i) => id !== defaultOrder[i])) {
			state.visibleTabIds = currentOrder;
		}
		if (!showSettingsButton) state.showSettingsButton = false;
		return state;
	}

	function emitStateChange(): void {
		onStateChange?.(buildState());
	}

	function getOrCreatePanel(tab: TabDefinition): HTMLElement {
		let panel = panelMap.get(tab.id);
		if (!panel) {
			panel = tabContent.createDiv({ cls: css.cls("tab-panel") });
			panel.dataset["tabId"] = tab.id;
			panelMap.set(tab.id, panel);
		}
		return panel;
	}

	function buildPanels(): void {
		for (const tab of visibleTabs) {
			getOrCreatePanel(tab);
		}
	}

	function renderPanelIfNeeded(tab: TabDefinition): void {
		if (rendered.has(tab.id)) return;
		rendered.add(tab.id);
		const panel = panelMap.get(tab.id);
		if (panel) void tab.render(panel);
	}

	function renderTabBar(): void {
		tabBar.empty();
		buttons = [];

		for (const tab of visibleTabs) {
			const button = tabBar.createEl("button", {
				text: getLabel(tab),
				cls: css.cls("tab"),
				attr: { "data-tab-id": tab.id },
			});
			button.addEventListener("click", () => handle.switchTo(tab.id));

			if (editable && config.app) {
				button.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					showTabTooltip(tab, e);
				});
			}

			buttons.push(button);
		}

		if (editable && config.app && showSettingsButton) {
			const settingsBtn = tabBar.createEl("button", { cls: css.cls("tab", "tab-settings") });
			setIcon(settingsBtn, "settings-2");
			settingsBtn.addEventListener("click", () => handle.showTabManager());
		}
	}

	function showTabTooltip(tab: TabDefinition, e: MouseEvent): void {
		const menu = new Menu();
		const idx = visibleTabs.findIndex((t) => t.id === tab.id);

		menu.addItem((item) => {
			item
				.setTitle("Rename")
				.setIcon("pencil")
				.onClick(() => showRenameModal(tab));
		});

		if (visibleTabs.length > 1) {
			menu.addItem((item) => {
				item
					.setTitle("Hide")
					.setIcon("eye-off")
					.onClick(() => hideTab(tab.id));
			});
		}

		if (idx > 0) {
			menu.addSeparator();
			menu.addItem((item) => {
				item
					.setTitle("Move left")
					.setIcon("arrow-left")
					.onClick(() => moveTab(tab.id, -1));
			});
		}

		if (idx < visibleTabs.length - 1) {
			if (idx === 0) menu.addSeparator();
			menu.addItem((item) => {
				item
					.setTitle("Move right")
					.setIcon("arrow-right")
					.onClick(() => moveTab(tab.id, 1));
			});
		}

		menu.showAtMouseEvent(e);
	}

	function showRenameModal(tab: TabDefinition, onDone?: () => void): void {
		if (!config.app) return;

		showModal({
			app: config.app,
			cls: css.cls("tab-rename-modal"),
			title: "Rename tab",
			render: (modalEl, ctx) => {
				const input = modalEl.createEl("input", {
					cls: css.cls("tab-rename-input"),
					attr: { type: "text", value: getLabel(tab) },
				});
				input.focus();
				input.select();

				const actions = modalEl.createDiv(css.cls("tab-rename-actions"));

				if (renames.has(tab.id)) {
					const resetBtn = actions.createEl("button", {
						text: "Reset",
						cls: css.cls("tab-rename-btn", "tab-rename-btn-reset"),
					});
					resetBtn.addEventListener("click", () => {
						renames.delete(tab.id);
						rebuild();
						onDone?.();
						ctx.close();
					});
				}

				const saveBtn = actions.createEl("button", {
					text: "Save",
					cls: css.cls("tab-rename-btn", "tab-rename-btn-save"),
				});
				saveBtn.addEventListener("click", () => {
					const newLabel = input.value.trim();
					if (newLabel && newLabel !== tab.label) {
						renames.set(tab.id, newLabel);
					} else {
						renames.delete(tab.id);
					}
					rebuild();
					onDone?.();
					ctx.close();
				});

				input.addEventListener("keydown", (e) => {
					if (e.key === "Enter") saveBtn.click();
				});
			},
		});
	}

	function showTabManager(): void {
		if (!config.app) return;

		showModal({
			app: config.app,
			cls: css.cls("tab-manager-modal"),
			title: "Manage Tabs",
			render: (modalEl) => {
				renderManagerList(modalEl);
			},
		});
	}

	function renderManagerList(root: HTMLElement): void {
		root.empty();

		new Setting(root).setName("Show settings button").addToggle((toggle) => {
			toggle.setValue(showSettingsButton);
			toggle.onChange((value) => {
				showSettingsButton = value;
				renderTabBar();
				activateTab(currentIndex);
				emitStateChange();
			});
		});

		const list = root.createDiv(css.cls("tab-manager-list"));

		const visibleIds = new Set(visibleTabs.map((t) => t.id));
		const orderedTabs = [...visibleTabs, ...allTabs.filter((t) => !visibleIds.has(t.id))];

		let draggedId: string | null = null;

		for (const tab of orderedTabs) {
			const isVisible = visibleIds.has(tab.id);
			const idx = visibleTabs.findIndex((t) => t.id === tab.id);

			const row = list.createDiv(css.cls("tab-manager-row"));
			if (!isVisible) css.addCls(row, "tab-manager-row-hidden");

			if (isVisible) {
				row.setAttribute("draggable", "true");
				row.dataset["tabId"] = tab.id;

				row.addEventListener("dragstart", (e) => {
					draggedId = tab.id;
					css.addCls(row, "tab-manager-row-dragging");
					if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
				});

				row.addEventListener("dragend", () => {
					draggedId = null;
					css.removeCls(row, "tab-manager-row-dragging");
				});

				row.addEventListener("dragover", (e) => {
					e.preventDefault();
					if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
					css.addCls(row, "tab-manager-row-dragover");
				});

				row.addEventListener("dragleave", () => {
					css.removeCls(row, "tab-manager-row-dragover");
				});

				row.addEventListener("drop", (e) => {
					e.preventDefault();
					css.removeCls(row, "tab-manager-row-dragover");
					if (!draggedId || draggedId === tab.id) return;

					const fromIdx = visibleTabs.findIndex((t) => t.id === draggedId);
					const toIdx = visibleTabs.findIndex((t) => t.id === tab.id);
					if (fromIdx < 0 || toIdx < 0) return;

					const activeId = visibleTabs[currentIndex]?.id;
					const updated = [...visibleTabs];
					const [moved] = updated.splice(fromIdx, 1);
					updated.splice(toIdx, 0, moved);
					visibleTabs = updated;

					currentIndex = visibleTabs.findIndex((t) => t.id === activeId);
					if (currentIndex < 0) currentIndex = 0;

					rebuild();
					renderManagerList(root);
				});
			}

			const dragHandle = row.createDiv(css.cls("tab-manager-drag"));
			if (isVisible) {
				const gripIcon = dragHandle.createEl("span", { cls: css.cls("tab-manager-grip") });
				setIcon(gripIcon, "grip-vertical");
			}

			const dragControls = row.createDiv(css.cls("tab-manager-arrows"));

			if (isVisible && idx > 0) {
				const upBtn = dragControls.createEl("button", { cls: css.cls("tab-manager-drag-btn") });
				setIcon(upBtn, "chevron-up");
				upBtn.addEventListener("click", () => {
					moveTab(tab.id, -1);
					renderManagerList(root);
				});
			}

			if (isVisible && idx < visibleTabs.length - 1) {
				const downBtn = dragControls.createEl("button", { cls: css.cls("tab-manager-drag-btn") });
				setIcon(downBtn, "chevron-down");
				downBtn.addEventListener("click", () => {
					moveTab(tab.id, 1);
					renderManagerList(root);
				});
			}

			const label = row.createDiv(css.cls("tab-manager-label"));
			label.createEl("span", { text: getLabel(tab), cls: css.cls("tab-manager-label-text") });

			if (renames.has(tab.id)) {
				const originalBadge = label.createEl("span", {
					text: tab.label,
					cls: css.cls("tab-manager-label-original"),
				});
				originalBadge.setAttribute("title", "Original name");
			}

			const controls = row.createDiv(css.cls("tab-manager-controls"));

			const renameBtn = controls.createEl("button", { cls: css.cls("tab-manager-btn") });
			setIcon(renameBtn, "pencil");
			renameBtn.setAttribute("title", "Rename");
			renameBtn.addEventListener("click", () => {
				showRenameModal(tab, () => renderManagerList(root));
			});

			const toggleBtn = controls.createEl("button", { cls: css.cls("tab-manager-btn") });
			if (isVisible) {
				setIcon(toggleBtn, "eye");
				toggleBtn.setAttribute("title", "Hide");
				if (visibleTabs.length <= 1) {
					toggleBtn.setAttribute("disabled", "true");
				}
				toggleBtn.addEventListener("click", () => {
					if (visibleTabs.length > 1) {
						hideTab(tab.id);
						renderManagerList(root);
					}
				});
			} else {
				setIcon(toggleBtn, "eye-off");
				toggleBtn.setAttribute("title", "Show");
				toggleBtn.addEventListener("click", () => {
					restoreTab(tab.id);
					renderManagerList(root);
				});
			}
		}
	}

	function hideTab(id: string): void {
		if (visibleTabs.length <= 1) return;
		const activeId = visibleTabs[currentIndex]?.id;

		visibleTabs = visibleTabs.filter((t) => t.id !== id);

		if (activeId === id) {
			currentIndex = Math.min(currentIndex, visibleTabs.length - 1);
		} else {
			currentIndex = visibleTabs.findIndex((t) => t.id === activeId);
			if (currentIndex < 0) currentIndex = 0;
		}

		rebuild();
	}

	function restoreTab(id: string): void {
		const tab = allTabs.find((t) => t.id === id);
		if (!tab || visibleTabs.find((t) => t.id === id)) return;

		const activeId = visibleTabs[currentIndex]?.id;
		visibleTabs = [...visibleTabs, tab];
		currentIndex = visibleTabs.findIndex((t) => t.id === activeId);
		if (currentIndex < 0) currentIndex = 0;

		getOrCreatePanel(tab);
		rebuild();
	}

	function moveTab(id: string, direction: -1 | 1): void {
		const idx = visibleTabs.findIndex((t) => t.id === id);
		const newIdx = idx + direction;
		if (idx < 0 || newIdx < 0 || newIdx >= visibleTabs.length) return;

		const activeId = visibleTabs[currentIndex]?.id;

		const updated = [...visibleTabs];
		[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
		visibleTabs = updated;

		currentIndex = visibleTabs.findIndex((t) => t.id === activeId);
		if (currentIndex < 0) currentIndex = 0;

		rebuild();
	}

	function rebuild(): void {
		renderTabBar();
		activateTab(currentIndex);
		emitStateChange();
	}

	function resolveIndex(indexOrId: number | string): number {
		if (typeof indexOrId === "number") return indexOrId;
		return visibleTabs.findIndex((t) => t.id === indexOrId);
	}

	function activateTab(index: number): void {
		if (index < 0 || index >= visibleTabs.length) return;

		for (const [, panel] of panelMap) {
			css.addCls(panel, "tab-panel-hidden");
		}
		for (let i = 0; i < buttons.length; i++) {
			css.removeCls(buttons[i], "tab-active");
		}

		const tab = visibleTabs[index];
		renderPanelIfNeeded(tab);
		const panel = panelMap.get(tab.id);

		if (panel) css.removeCls(panel, "tab-panel-hidden");
		if (buttons[index]) css.addCls(buttons[index], "tab-active");
		currentIndex = index;
	}

	const handle: TabbedContainerHandle = {
		switchTo(indexOrId: number | string): void {
			if (destroyed) return;
			const index = resolveIndex(indexOrId);
			if (index < 0 || index >= visibleTabs.length || index === currentIndex) return;
			activateTab(index);
			onTabChange?.(visibleTabs[currentIndex].id, currentIndex);
			emitStateChange();
		},

		next(): void {
			if (destroyed || visibleTabs.length === 0) return;
			const next = (currentIndex + 1) % visibleTabs.length;
			handle.switchTo(next);
		},

		previous(): void {
			if (destroyed || visibleTabs.length === 0) return;
			const prev = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
			handle.switchTo(prev);
		},

		hideTab(id: string): void {
			if (destroyed) return;
			hideTab(id);
		},

		restoreTab(id: string): void {
			if (destroyed) return;
			restoreTab(id);
		},

		moveTab(id: string, direction: -1 | 1): void {
			if (destroyed) return;
			moveTab(id, direction);
		},

		showTabManager(): void {
			if (destroyed) return;
			showTabManager();
		},

		getState(): TabbedContainerState {
			return buildState();
		},

		get activeIndex(): number {
			return currentIndex;
		},

		get activeId(): string {
			return visibleTabs.length > 0 ? visibleTabs[currentIndex].id : "";
		},

		get tabCount(): number {
			return visibleTabs.length;
		},

		destroy(): void {
			if (destroyed) return;
			destroyed = true;
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("keydown", onKeyDown);
			for (const tab of allTabs) {
				tab.cleanup?.();
			}
			tabBar.remove();
			container.empty();
		},
	};

	return handle;
}
