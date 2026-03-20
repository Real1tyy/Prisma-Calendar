import { Menu, setIcon, Setting } from "obsidian";

import { showModal } from "../component-renderer/modal";
import { createCssUtils } from "../core/css-utils";
import { injectTabStyles } from "./styles";
import type {
	GroupChildState,
	GroupTabDefinition,
	TabbedContainerConfig,
	TabbedContainerHandle,
	TabbedContainerState,
	TabDefinition,
	TabEntry,
} from "./types";
import { isGroupTab } from "./types";

function flattenEntry(entry: TabEntry): TabDefinition {
	if (isGroupTab(entry)) return entry.children[0];
	return entry;
}

function resolveVisibleTabs(config: TabbedContainerConfig): {
	visibleTabs: TabEntry[];
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
	const visible: TabEntry[] = [];
	for (const id of initialState.visibleTabIds) {
		const tab = tabMap.get(id);
		if (tab) visible.push(tab);
	}

	return { visibleTabs: visible.length > 0 ? visible : tabs, renames };
}

export function createTabbedContainer(container: HTMLElement, config: TabbedContainerConfig): TabbedContainerHandle {
	const {
		cssPrefix,
		onTabChange,
		onStateChange,
		lazy = true,
		tabBarContainer,
		tabBarInsertBefore,
		editable,
		hoverDropdown = false,
	} = config;
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

	const groupChildState = new Map<string, GroupChildState>();
	let activeGroupMenu: Menu | null = null;
	let skipNextGroupClick = false;
	let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
	const managerExpandedGroups = new Set<string>();
	initGroupStates();

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
		const entry = visibleTabs[currentIndex];
		const tab = entry ? getActiveChild(entry) : undefined;
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
		for (const entry of visibleTabs) {
			renderPanelIfNeeded(getActiveChild(entry));
		}
	}

	function initGroupStates(): void {
		const savedGroupState = config.initialState?.groupState;
		for (const entry of allTabs) {
			if (!isGroupTab(entry)) continue;
			const saved = savedGroupState?.[entry.id];
			const childRenames = new Map<string, string>();
			if (saved?.childRenames) {
				for (const [id, label] of Object.entries(saved.childRenames)) {
					childRenames.set(id, label);
				}
			}

			let visibleChildren: TabDefinition[];
			if (saved?.visibleChildIds) {
				const childMap = new Map(entry.children.map((c) => [c.id, c]));
				visibleChildren = saved.visibleChildIds
					.map((id) => childMap.get(id))
					.filter((c): c is TabDefinition => c != null);
				if (visibleChildren.length === 0) visibleChildren = [...entry.children];
			} else {
				visibleChildren = [...entry.children];
			}

			groupChildState.set(entry.id, {
				allChildren: entry.children,
				visibleChildren,
				activeChildIndex: 0,
				childRenames,
			});
		}
	}

	function getActiveChild(entry: TabEntry): TabDefinition {
		if (!isGroupTab(entry)) return entry;
		const gs = groupChildState.get(entry.id);
		if (!gs || gs.visibleChildren.length === 0) return entry.children[0];
		return gs.visibleChildren[gs.activeChildIndex] ?? gs.visibleChildren[0];
	}

	function getChildLabel(groupId: string, child: TabDefinition): string {
		const gs = groupChildState.get(groupId);
		return gs?.childRenames.get(child.id) ?? child.label;
	}

	function getLabel(entry: TabEntry): string {
		return renames.get(entry.id) ?? entry.label;
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

		const gs: Record<string, { visibleChildIds?: string[]; childRenames?: Record<string, string> }> = {};
		let hasGroupState = false;
		for (const [groupId, childState] of groupChildState) {
			const group = allTabs.find((t) => t.id === groupId) as GroupTabDefinition | undefined;
			if (!group) continue;
			const entry: { visibleChildIds?: string[]; childRenames?: Record<string, string> } = {};
			let hasEntry = false;

			const defaultChildOrder = group.children.map((c) => c.id);
			const currentChildOrder = childState.visibleChildren.map((c) => c.id);
			if (
				childState.visibleChildren.length !== group.children.length ||
				currentChildOrder.some((id, i) => id !== defaultChildOrder[i])
			) {
				entry.visibleChildIds = currentChildOrder;
				hasEntry = true;
			}

			if (childState.childRenames.size > 0) {
				entry.childRenames = Object.fromEntries(childState.childRenames);
				hasEntry = true;
			}

			if (hasEntry) {
				gs[groupId] = entry;
				hasGroupState = true;
			}
		}
		if (hasGroupState) state.groupState = gs;

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
		for (const entry of visibleTabs) {
			getOrCreatePanel(getActiveChild(entry));
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

		for (const entry of visibleTabs) {
			if (isGroupTab(entry)) {
				const button = tabBar.createEl("button", {
					cls: css.cls("tab", "tab-group"),
					attr: { "data-tab-id": entry.id },
				});
				button.createEl("span", { text: getLabel(entry) });
				const chevron = button.createEl("span", { cls: css.cls("tab-group-chevron") });
				setIcon(chevron, "chevron-down");

				button.addEventListener("pointerdown", () => {
					if (activeGroupMenu) {
						skipNextGroupClick = true;
						activeGroupMenu.close();
					}
				});
				button.addEventListener("click", () => {
					if (skipNextGroupClick) {
						skipNextGroupClick = false;
						return;
					}
					showGroupDropdown(entry, button);
				});

				if (hoverDropdown) {
					button.addEventListener("mouseenter", () => {
						if (hoverCloseTimer) {
							clearTimeout(hoverCloseTimer);
							hoverCloseTimer = null;
						}
						if (!activeGroupMenu) {
							showGroupDropdown(entry, button);
						}
					});
					button.addEventListener("mouseleave", () => {
						scheduleHoverClose();
					});
				}

				if (editable && config.app) {
					button.addEventListener("contextmenu", (e) => {
						e.preventDefault();
						showTabTooltip(entry, e);
					});
				}

				buttons.push(button);
			} else {
				const button = tabBar.createEl("button", {
					text: getLabel(entry),
					cls: css.cls("tab"),
					attr: { "data-tab-id": entry.id },
				});
				button.addEventListener("click", () => handle.switchTo(entry.id));

				if (editable && config.app) {
					button.addEventListener("contextmenu", (e) => {
						e.preventDefault();
						showTabTooltip(entry, e);
					});
				}

				buttons.push(button);
			}
		}

		if (editable && config.app && showSettingsButton) {
			const settingsBtn = tabBar.createEl("button", { cls: css.cls("tab", "tab-settings") });
			setIcon(settingsBtn, "settings-2");
			settingsBtn.addEventListener("click", () => handle.showTabManager());
		}
	}

	function scheduleHoverClose(): void {
		if (hoverCloseTimer) clearTimeout(hoverCloseTimer);
		hoverCloseTimer = setTimeout(() => {
			hoverCloseTimer = null;
			activeGroupMenu?.close();
		}, 200);
	}

	function onGroupMenuClosed(): void {
		activeGroupMenu = null;
	}

	function showGroupDropdown(group: GroupTabDefinition, anchor: HTMLElement): void {
		if (activeGroupMenu) {
			activeGroupMenu.close();
			activeGroupMenu = null;
		}

		const gs = groupChildState.get(group.id);
		if (!gs) return;

		const menu = new Menu();
		const origClose = menu.close.bind(menu);
		menu.close = () => {
			onGroupMenuClosed();
			origClose();
		};

		activeGroupMenu = menu;

		for (const child of gs.visibleChildren) {
			menu.addItem((item) => {
				item.setTitle(getChildLabel(group.id, child)).onClick(() => {
					switchGroupChildInternal(group.id, child.id);
				});
			});
		}

		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });

		if (hoverDropdown) {
			const menuEl = (menu as unknown as { dom?: HTMLElement }).dom;
			if (menuEl) {
				menuEl.addEventListener("mouseenter", () => {
					if (hoverCloseTimer) {
						clearTimeout(hoverCloseTimer);
						hoverCloseTimer = null;
					}
				});
				menuEl.addEventListener("mouseleave", () => {
					scheduleHoverClose();
				});
			}
		}
	}

	function switchGroupChildInternal(groupId: string, childId: string): void {
		activeGroupMenu = null;
		const gs = groupChildState.get(groupId);
		if (!gs) return;
		const childIdx = gs.visibleChildren.findIndex((c) => c.id === childId);
		if (childIdx < 0) return;

		gs.activeChildIndex = childIdx;
		const child = gs.visibleChildren[childIdx];
		getOrCreatePanel(child);

		const groupIndex = visibleTabs.findIndex((t) => t.id === groupId);
		if (groupIndex >= 0 && groupIndex !== currentIndex) {
			activateTab(groupIndex);
			onTabChange?.(groupId, groupIndex);
		} else {
			rebuild();
		}
	}

	function showTabTooltip(entry: TabEntry, e: MouseEvent): void {
		const menu = new Menu();
		const idx = visibleTabs.findIndex((t) => t.id === entry.id);

		menu.addItem((item) => {
			item
				.setTitle("Rename")
				.setIcon("pencil")
				.onClick(() => showRenameModal(entry));
		});

		if (visibleTabs.length > 1) {
			menu.addItem((item) => {
				item
					.setTitle("Hide")
					.setIcon("eye-off")
					.onClick(() => hideTab(entry.id));
			});
		}

		if (idx > 0) {
			menu.addSeparator();
			menu.addItem((item) => {
				item
					.setTitle("Move left")
					.setIcon("arrow-left")
					.onClick(() => moveTab(entry.id, -1));
			});
		}

		if (idx < visibleTabs.length - 1) {
			if (idx === 0) menu.addSeparator();
			menu.addItem((item) => {
				item
					.setTitle("Move right")
					.setIcon("arrow-right")
					.onClick(() => moveTab(entry.id, 1));
			});
		}

		menu.showAtMouseEvent(e);
	}

	interface RenameOps {
		currentLabel: string;
		originalLabel: string;
		hasRename: boolean;
		save: (label: string) => void;
		reset: () => void;
	}

	function openRenameModal(ops: RenameOps, onDone?: () => void): void {
		if (!config.app) return;

		showModal({
			app: config.app,
			cls: css.cls("tab-rename-modal"),
			title: "Rename tab",
			render: (modalEl, ctx) => {
				const input = modalEl.createEl("input", {
					cls: css.cls("tab-rename-input"),
					attr: { type: "text", value: ops.currentLabel },
				});
				input.focus();
				input.select();

				const actions = modalEl.createDiv(css.cls("tab-rename-actions"));

				if (ops.hasRename) {
					const resetBtn = actions.createEl("button", {
						text: "Reset",
						cls: css.cls("tab-rename-btn", "tab-rename-btn-reset"),
					});
					resetBtn.addEventListener("click", () => {
						ops.reset();
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
					if (newLabel && newLabel !== ops.originalLabel) {
						ops.save(newLabel);
					} else {
						ops.reset();
					}
					rebuild();
					onDone?.();
					ctx.close();
				});

				input.addEventListener("keydown", (ev) => {
					if (ev.key === "Enter") saveBtn.click();
				});
			},
		});
	}

	function showRenameModal(entry: TabEntry, onDone?: () => void): void {
		openRenameModal(
			{
				currentLabel: getLabel(entry),
				originalLabel: entry.label,
				hasRename: renames.has(entry.id),
				save: (label) => renames.set(entry.id, label),
				reset: () => renames.delete(entry.id),
			},
			onDone
		);
	}

	function showChildRenameModal(groupId: string, child: TabDefinition, onDone?: () => void): void {
		const gs = groupChildState.get(groupId);
		if (!gs) return;
		openRenameModal(
			{
				currentLabel: gs.childRenames.get(child.id) ?? child.label,
				originalLabel: child.label,
				hasRename: gs.childRenames.has(child.id),
				save: (label) => gs.childRenames.set(child.id, label),
				reset: () => gs.childRenames.delete(child.id),
			},
			onDone
		);
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

	interface ManagerRowConfig {
		itemId: string;
		displayLabel: string;
		originalLabel: string;
		isVisible: boolean;
		visibleIndex: number;
		visibleCount: number;
		hasRename: boolean;
		dragRef: { value: string | null };
		onRename: (rerender: () => void) => void;
		onHide: (() => void) | null;
		onShow: (() => void) | null;
		onMove: ((direction: -1 | 1) => void) | null;
		onDrop: (fromId: string) => void;
	}

	function renderManagerRow(parent: HTMLElement, cfg: ManagerRowConfig, rerender: () => void): HTMLElement {
		const row = parent.createDiv(css.cls("tab-manager-row"));
		if (!cfg.isVisible) css.addCls(row, "tab-manager-row-hidden");

		if (cfg.isVisible) {
			row.setAttribute("draggable", "true");
			row.dataset["tabId"] = cfg.itemId;

			row.addEventListener("dragstart", (e) => {
				cfg.dragRef.value = cfg.itemId;
				css.addCls(row, "tab-manager-row-dragging");
				if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
			});
			row.addEventListener("dragend", () => {
				cfg.dragRef.value = null;
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
				if (!cfg.dragRef.value || cfg.dragRef.value === cfg.itemId) return;
				cfg.onDrop(cfg.dragRef.value);
				rerender();
			});
		}

		const dragHandle = row.createDiv(css.cls("tab-manager-drag"));
		if (cfg.isVisible) {
			const gripIcon = dragHandle.createEl("span", { cls: css.cls("tab-manager-grip") });
			setIcon(gripIcon, "grip-vertical");
		}

		const arrows = row.createDiv(css.cls("tab-manager-arrows"));
		if (cfg.isVisible && cfg.onMove && cfg.visibleIndex > 0) {
			const upBtn = arrows.createEl("button", { cls: css.cls("tab-manager-drag-btn") });
			setIcon(upBtn, "chevron-up");
			upBtn.addEventListener("click", () => {
				cfg.onMove!(-1);
				rerender();
			});
		}
		if (cfg.isVisible && cfg.onMove && cfg.visibleIndex < cfg.visibleCount - 1) {
			const downBtn = arrows.createEl("button", { cls: css.cls("tab-manager-drag-btn") });
			setIcon(downBtn, "chevron-down");
			downBtn.addEventListener("click", () => {
				cfg.onMove!(1);
				rerender();
			});
		}

		const labelEl = row.createDiv(css.cls("tab-manager-label"));
		labelEl.createEl("span", { text: cfg.displayLabel, cls: css.cls("tab-manager-label-text") });
		if (cfg.hasRename) {
			const badge = labelEl.createEl("span", {
				text: cfg.originalLabel,
				cls: css.cls("tab-manager-label-original"),
			});
			badge.setAttribute("title", "Original name");
		}

		const controls = row.createDiv(css.cls("tab-manager-controls"));

		const renameBtn = controls.createEl("button", { cls: css.cls("tab-manager-btn") });
		setIcon(renameBtn, "pencil");
		renameBtn.setAttribute("title", "Rename");
		renameBtn.addEventListener("click", () => cfg.onRename(rerender));

		const toggleBtn = controls.createEl("button", { cls: css.cls("tab-manager-btn") });
		if (cfg.isVisible) {
			setIcon(toggleBtn, "eye");
			toggleBtn.setAttribute("title", "Hide");
			if (!cfg.onHide) toggleBtn.setAttribute("disabled", "true");
			toggleBtn.addEventListener("click", () => {
				cfg.onHide?.();
				rerender();
			});
		} else {
			setIcon(toggleBtn, "eye-off");
			toggleBtn.setAttribute("title", "Show");
			toggleBtn.addEventListener("click", () => {
				cfg.onShow?.();
				rerender();
			});
		}

		return row;
	}

	function reorderList<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
		const fromIdx = items.findIndex((t) => t.id === fromId);
		const toIdx = items.findIndex((t) => t.id === toId);
		if (fromIdx < 0 || toIdx < 0) return items;
		const updated = [...items];
		const [moved] = updated.splice(fromIdx, 1);
		updated.splice(toIdx, 0, moved);
		return updated;
	}

	function moveGroupChild(gs: GroupChildState, childId: string, direction: -1 | 1): void {
		const idx = gs.visibleChildren.findIndex((c) => c.id === childId);
		const newIdx = idx + direction;
		if (idx < 0 || newIdx < 0 || newIdx >= gs.visibleChildren.length) return;
		const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
		const arr = [...gs.visibleChildren];
		[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
		gs.visibleChildren = arr;
		gs.activeChildIndex = Math.max(
			0,
			arr.findIndex((c) => c.id === activeId)
		);
		rebuild();
	}

	function reorderGroupChildren(gs: GroupChildState, fromId: string, toId: string): void {
		const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
		gs.visibleChildren = reorderList(gs.visibleChildren, fromId, toId);
		gs.activeChildIndex = Math.max(
			0,
			gs.visibleChildren.findIndex((c) => c.id === activeId)
		);
		rebuild();
	}

	function renderManagerList(root: HTMLElement): void {
		root.empty();
		const rerender = () => renderManagerList(root);

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
		const dragRef = { value: null as string | null };

		for (const tab of orderedTabs) {
			const isVisible = visibleIds.has(tab.id);
			const idx = visibleTabs.findIndex((t) => t.id === tab.id);

			const row = renderManagerRow(
				list,
				{
					itemId: tab.id,
					displayLabel: getLabel(tab),
					originalLabel: tab.label,
					isVisible,
					visibleIndex: idx,
					visibleCount: visibleTabs.length,
					hasRename: renames.has(tab.id),
					dragRef,
					onRename: (done) => showRenameModal(tab, done),
					onHide: isVisible && visibleTabs.length > 1 ? () => hideTab(tab.id) : null,
					onShow: !isVisible ? () => restoreTab(tab.id) : null,
					onMove: isVisible ? (dir) => moveTab(tab.id, dir) : null,
					onDrop: (fromId) => {
						const activeId = visibleTabs[currentIndex]?.id;
						visibleTabs = reorderList(visibleTabs, fromId, tab.id);
						currentIndex = Math.max(
							0,
							visibleTabs.findIndex((t) => t.id === activeId)
						);
						rebuild();
					},
				},
				rerender
			);

			if (isGroupTab(tab)) {
				const groupToggleBtn = row.createEl("button", { cls: css.cls("tab-manager-group-toggle") });
				setIcon(groupToggleBtn, managerExpandedGroups.has(tab.id) ? "chevron-down" : "chevron-right");
				row.insertBefore(groupToggleBtn, row.firstChild);

				const childrenContainer = list.createDiv(css.cls("tab-manager-children"));
				if (!managerExpandedGroups.has(tab.id)) childrenContainer.style.display = "none";

				groupToggleBtn.addEventListener("click", () => {
					if (managerExpandedGroups.has(tab.id)) {
						managerExpandedGroups.delete(tab.id);
						childrenContainer.style.display = "none";
						setIcon(groupToggleBtn, "chevron-right");
					} else {
						managerExpandedGroups.add(tab.id);
						childrenContainer.style.display = "";
						setIcon(groupToggleBtn, "chevron-down");
					}
				});

				const gs = groupChildState.get(tab.id);
				if (gs) {
					const visibleChildIds = new Set(gs.visibleChildren.map((c) => c.id));
					const orderedChildren = [...gs.visibleChildren, ...gs.allChildren.filter((c) => !visibleChildIds.has(c.id))];
					const childDragRef = { value: null as string | null };

					for (const child of orderedChildren) {
						const childVisible = visibleChildIds.has(child.id);
						const childIdx = gs.visibleChildren.findIndex((c) => c.id === child.id);

						renderManagerRow(
							childrenContainer,
							{
								itemId: child.id,
								displayLabel: getChildLabel(tab.id, child),
								originalLabel: child.label,
								isVisible: childVisible,
								visibleIndex: childIdx,
								visibleCount: gs.visibleChildren.length,
								hasRename: gs.childRenames.has(child.id),
								dragRef: childDragRef,
								onRename: (done) => showChildRenameModal(tab.id, child, done),
								onHide:
									childVisible && gs.visibleChildren.length > 1
										? () => {
												const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
												gs.visibleChildren = gs.visibleChildren.filter((c) => c.id !== child.id);
												if (activeId === child.id) {
													gs.activeChildIndex = Math.min(gs.activeChildIndex, gs.visibleChildren.length - 1);
												} else {
													gs.activeChildIndex = Math.max(
														0,
														gs.visibleChildren.findIndex((c) => c.id === activeId)
													);
												}
												rebuild();
											}
										: null,
								onShow: !childVisible
									? () => {
											gs.visibleChildren = [...gs.visibleChildren, child];
											getOrCreatePanel(child);
											rebuild();
										}
									: null,
								onMove: childVisible ? (dir) => moveGroupChild(gs, child.id, dir) : null,
								onDrop: (fromId) => reorderGroupChildren(gs, fromId, child.id),
							},
							rerender
						);
					}
				}
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

		getOrCreatePanel(flattenEntry(tab));
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

		const entry = visibleTabs[index];
		const tab = getActiveChild(entry);
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
			if (hoverCloseTimer) clearTimeout(hoverCloseTimer);
			activeGroupMenu?.close();
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("keydown", onKeyDown);
			for (const entry of allTabs) {
				if (isGroupTab(entry)) {
					for (const child of entry.children) {
						child.cleanup?.();
					}
				} else {
					entry.cleanup?.();
				}
			}
			tabBar.remove();
			container.empty();
		},
	};

	return handle;
}
