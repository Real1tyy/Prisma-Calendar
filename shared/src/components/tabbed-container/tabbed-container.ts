import { Menu, setIcon, Setting } from "obsidian";

import { createCssUtils } from "../../utils/css-utils";
import { showModal } from "../component-renderer/modal";
import { renderManagerRowContent } from "../primitives/manager-row";
import { hideGroupChild, reorderGroupChildren, reorderList, showGroupChild } from "./reorder";
import { injectTabStyles } from "./styles";
import type {
	GroupChildState,
	GroupStatePersisted,
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

function loadStringRecord(source: Record<string, string> | undefined): Map<string, string> {
	return new Map(Object.entries(source ?? {}));
}

function resolveVisibleTabs(config: TabbedContainerConfig): {
	visibleTabs: TabEntry[];
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
} {
	const { tabs, initialState } = config;
	const renames = loadStringRecord(initialState?.renames);
	const iconOverrides = loadStringRecord(initialState?.iconOverrides);
	const colorOverrides = loadStringRecord(initialState?.colorOverrides);

	if (!initialState?.visibleTabIds) {
		return { visibleTabs: tabs, renames, iconOverrides, colorOverrides };
	}

	const tabMap = new Map(tabs.map((t) => [t.id, t]));
	const visible: TabEntry[] = [];
	for (const id of initialState.visibleTabIds) {
		const tab = tabMap.get(id);
		if (tab) visible.push(tab);
	}

	return { visibleTabs: visible.length > 0 ? visible : tabs, renames, iconOverrides, colorOverrides };
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

	const resolved = resolveVisibleTabs(config);
	const renames = resolved.renames;
	const iconOverrides = resolved.iconOverrides;
	const colorOverrides = resolved.colorOverrides;
	let visibleTabs = [...resolved.visibleTabs];
	let currentIndex = 0;
	let showSettingsButton = config.initialState?.showSettingsButton !== false;
	let destroyed = false;

	const groupChildState = new Map<string, GroupChildState>();
	let activeGroupMenu: Menu | null = null;
	let skipNextGroupClick = false;
	let hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
	const managerExpandedGroups = new Set<string>();
	let managerExpandedId: string | null = null;
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
		const tab = getActiveChild(entry);
		const handler = tab.keyHandlers?.[e.key];
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
			const childRenames = loadStringRecord(saved?.childRenames);
			const childIconOverrides = loadStringRecord(saved?.childIconOverrides);
			const childColorOverrides = loadStringRecord(saved?.childColorOverrides);

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
				childIconOverrides,
				childColorOverrides,
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

	function getIcon(entry: TabEntry): string | undefined {
		return iconOverrides.get(entry.id) ?? entry.icon;
	}

	function getColor(entry: TabEntry): string | undefined {
		return colorOverrides.get(entry.id) ?? (entry as TabDefinition).color;
	}

	function buildState(): TabbedContainerState {
		const state: TabbedContainerState = {};
		if (renames.size > 0) state.renames = Object.fromEntries(renames);
		if (iconOverrides.size > 0) state.iconOverrides = Object.fromEntries(iconOverrides);
		if (colorOverrides.size > 0) state.colorOverrides = Object.fromEntries(colorOverrides);
		const defaultOrder = allTabs.map((t) => t.id);
		const currentOrder = visibleTabs.map((t) => t.id);
		if (visibleTabs.length !== allTabs.length || currentOrder.some((id, i) => id !== defaultOrder[i])) {
			state.visibleTabIds = currentOrder;
		}
		if (!showSettingsButton) state.showSettingsButton = false;

		const gs: Record<string, GroupStatePersisted> = {};
		let hasGroupState = false;
		for (const [groupId, childState] of groupChildState) {
			const group = allTabs.find((t) => t.id === groupId) as GroupTabDefinition | undefined;
			if (!group) continue;
			const entry: GroupStatePersisted = {};
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

			if (childState.childIconOverrides.size > 0) {
				entry.childIconOverrides = Object.fromEntries(childState.childIconOverrides);
				hasEntry = true;
			}

			if (childState.childColorOverrides.size > 0) {
				entry.childColorOverrides = Object.fromEntries(childState.childColorOverrides);
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
					attr: { "data-tab-id": entry.id, "data-testid": `${cssPrefix}view-tab-${entry.id}` },
				});
				const groupIcon = getIcon(entry);
				const groupColor = getColor(entry);
				if (groupIcon) {
					const iconSpan = button.createEl("span", { cls: css.cls("tab-icon") });
					setIcon(iconSpan, groupIcon);
					if (groupColor) iconSpan.style.setProperty("color", groupColor);
				}
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
					cls: css.cls("tab"),
					attr: { "data-tab-id": entry.id, "data-testid": `${cssPrefix}view-tab-${entry.id}` },
				});
				const tabIcon = getIcon(entry);
				const tabColor = getColor(entry);
				if (tabIcon) {
					const iconSpan = button.createEl("span", { cls: css.cls("tab-icon") });
					setIcon(iconSpan, tabIcon);
					if (tabColor) iconSpan.style.setProperty("color", tabColor);
				}
				button.createEl("span", { text: getLabel(entry) });
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
			settingsBtn.setAttribute("data-testid", `${cssPrefix}tabbed-container-manage`);
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
				const row = (item as unknown as { dom?: HTMLElement }).dom;
				if (row) row.setAttribute("data-testid", `${cssPrefix}view-tab-${child.id}`);
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
				.setTitle("Edit")
				.setIcon("pencil")
				.onClick(() => handle.showTabManager());
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

	function setOrDelete(map: Map<string, string>, key: string, value: string | undefined): void {
		if (value) map.set(key, value);
		else map.delete(key);
		emitStateChange();
		rebuild();
	}

	function handleRename(id: string, v: string | undefined): void {
		setOrDelete(renames, id, v);
	}
	function handleIconChange(id: string, v: string | undefined): void {
		setOrDelete(iconOverrides, id, v);
	}
	function handleColorChange(id: string, v: string | undefined): void {
		setOrDelete(colorOverrides, id, v);
	}

	function handleChildRename(groupId: string, childId: string, v: string | undefined): void {
		const gs = groupChildState.get(groupId);
		if (gs) setOrDelete(gs.childRenames, childId, v);
	}
	function handleChildIconChange(groupId: string, childId: string, v: string | undefined): void {
		const gs = groupChildState.get(groupId);
		if (gs) setOrDelete(gs.childIconOverrides, childId, v);
	}
	function handleChildColorChange(groupId: string, childId: string, v: string | undefined): void {
		const gs = groupChildState.get(groupId);
		if (gs) setOrDelete(gs.childColorOverrides, childId, v);
	}

	function showTabManager(): void {
		if (!config.app) return;

		showModal({
			app: config.app,
			cls: css.cls("tab-manager-modal"),
			title: "Manage Tabs",
			render: (modalEl) => {
				modalEl.setAttribute("data-testid", `${cssPrefix}tab-manager-modal`);
				renderManagerList(modalEl);
			},
		});
	}

	type DragContext = { current: string | null };

	function attachDragHandlers(
		row: HTMLElement,
		itemId: string,
		ctx: DragContext,
		onDrop: (draggedId: string) => void
	): void {
		row.setAttribute("draggable", "true");
		row.dataset["tabId"] = itemId;
		row.addEventListener("dragstart", (e) => {
			ctx.current = itemId;
			css.addCls(row, "tab-manager-row-dragging");
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		});
		row.addEventListener("dragend", () => {
			ctx.current = null;
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
			if (!ctx.current || ctx.current === itemId) return;
			onDrop(ctx.current);
		});
		const handle = row.createDiv(css.cls("tab-manager-drag"));
		const grip = handle.createEl("span", { cls: css.cls("tab-manager-grip") });
		setIcon(grip, "grip-vertical");
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
		const dragCtx: DragContext = { current: null };

		for (const tab of orderedTabs) {
			const isVisible = visibleIds.has(tab.id);
			const isExpanded = managerExpandedId === tab.id;

			const row = list.createDiv(css.cls("tab-manager-row"));
			if (cssPrefix) row.setAttribute("data-testid", `${cssPrefix}tab-manager-row-${tab.id}`);
			if (!isVisible) css.addCls(row, "tab-manager-row-hidden");

			if (isVisible) {
				attachDragHandlers(row, tab.id, dragCtx, (draggedId) => {
					const activeId = visibleTabs[currentIndex]?.id;
					visibleTabs = reorderList(visibleTabs, draggedId, tab.id);
					currentIndex = Math.max(
						0,
						visibleTabs.findIndex((t) => t.id === activeId)
					);
					rebuild();
					rerender();
				});
			}

			renderManagerRowContent(row, {
				app: config.app!,
				css,
				rowPrefix: "tab-manager",
				testIdPrefix: cssPrefix,
				item: tab,
				isVisible,
				isExpanded,
				visibleCount: visibleTabs.length,
				renames,
				iconOverrides,
				colorOverrides,
				onToggleExpand: () => {
					managerExpandedId = isExpanded ? null : tab.id;
					rerender();
				},
				onHide: () => {
					hideTab(tab.id);
					rerender();
				},
				onRestore: () => {
					restoreTab(tab.id);
					rerender();
				},
				onRename: handleRename,
				onIconChange: handleIconChange,
				onColorChange: handleColorChange,
				rerender,
			});

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
					const childDragCtx: DragContext = { current: null };

					for (const child of orderedChildren) {
						const childVisible = visibleChildIds.has(child.id);
						const childExpanded = managerExpandedId === `${tab.id}:${child.id}`;

						const childRow = childrenContainer.createDiv(css.cls("tab-manager-row"));
						if (cssPrefix) childRow.setAttribute("data-testid", `${cssPrefix}tab-manager-row-${child.id}`);
						if (!childVisible) css.addCls(childRow, "tab-manager-row-hidden");

						if (childVisible) {
							attachDragHandlers(childRow, child.id, childDragCtx, (draggedId) => {
								reorderGroupChildren(gs, draggedId, child.id);
								rebuild();
								rerender();
							});
						}

						renderManagerRowContent(childRow, {
							app: config.app!,
							css,
							rowPrefix: "tab-manager",
							testIdPrefix: cssPrefix,
							item: child,
							isVisible: childVisible,
							isExpanded: childExpanded,
							visibleCount: gs.visibleChildren.length,
							renames: gs.childRenames,
							iconOverrides: gs.childIconOverrides,
							colorOverrides: gs.childColorOverrides,
							onToggleExpand: () => {
								const key = `${tab.id}:${child.id}`;
								managerExpandedId = childExpanded ? null : key;
								rerender();
							},
							onHide: () => {
								hideGroupChild(gs, child);
								rebuild();
								rerender();
							},
							onRestore: () => {
								showGroupChild(gs, child);
								getOrCreatePanel(child);
								rebuild();
								rerender();
							},
							onRename: (id, label) => handleChildRename(tab.id, id, label),
							onIconChange: (id, icon) => handleChildIconChange(tab.id, id, icon),
							onColorChange: (id, color) => handleChildColorChange(tab.id, id, color),
							rerender,
						});
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
		const panel = panelMap.get(tab.id);
		if (panel) css.removeCls(panel, "tab-panel-hidden");

		renderPanelIfNeeded(tab);

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

		getVisibleLabels(): string[] {
			return visibleTabs.map((entry) => getLabel(entry));
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
