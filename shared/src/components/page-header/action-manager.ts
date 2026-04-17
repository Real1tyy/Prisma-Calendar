import type { App } from "obsidian";
import { setIcon, Setting } from "obsidian";

import { createCssUtils } from "../../utils/css-utils";
import { showModal } from "../component-renderer/modal";
import type { ModalContext } from "../component-renderer/types";
import { renderManagerRowContent } from "../primitives/manager-row";
import type { HeaderActionDefinition } from "./types";

export interface ActionManagerConfig {
	app: App;
	cssPrefix: string;
	allActions: HeaderActionDefinition[];
	getVisibleActions: () => HeaderActionDefinition[];
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	showSettingsButton: boolean;
	onHide: (id: string) => void;
	onRestore: (id: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	onToggleSettingsButton: (visible: boolean) => void;
}

export function openActionManager(config: ActionManagerConfig): void {
	const { app, cssPrefix, allActions } = config;
	const css = createCssUtils(cssPrefix);

	let expandedActionId: string | null = null;

	let modalCtx: ModalContext;

	showModal({
		app,
		cls: css.cls("action-manager-modal"),
		title: "Manage Header Actions",
		search: { cssPrefix, placeholder: "Search actions..." },
		render: (contentEl, ctx) => {
			modalCtx = ctx as ModalContext;
			contentEl.setAttribute("data-testid", `${cssPrefix}action-manager-modal`);
			renderManagerList(contentEl);
		},
	});

	function matchesSearch(action: HeaderActionDefinition): boolean {
		const query = modalCtx.searchQuery;
		if (!query) return true;
		const displayLabel = config.renames.get(action.id) ?? action.label;
		return (
			displayLabel.toLowerCase().includes(query) ||
			action.label.toLowerCase().includes(query) ||
			action.id.toLowerCase().includes(query)
		);
	}

	function renderManagerList(root: HTMLElement): void {
		root.empty();

		const isSearching = modalCtx.searchQuery.length > 0;
		const visibleActions = config.getVisibleActions();

		if (!isSearching) {
			new Setting(root).setName("Show settings button").addToggle((toggle) => {
				toggle.setValue(config.showSettingsButton);
				toggle.onChange((value) => {
					config.showSettingsButton = value;
					config.onToggleSettingsButton(value);
				});
			});
		}

		const list = root.createDiv(css.cls("action-manager-list"));

		const visibleIds = new Set(visibleActions.map((a) => a.id));
		const orderedActions = [...visibleActions, ...allActions.filter((a) => !visibleIds.has(a.id))];
		const filteredActions = orderedActions.filter((a) => matchesSearch(a));

		if (isSearching && filteredActions.length === 0) {
			list.createDiv({
				text: "No matching actions",
				cls: css.cls("modal-search-empty"),
			});
			return;
		}

		let draggedId: string | null = null;

		for (const action of filteredActions) {
			const isVisible = visibleIds.has(action.id);
			const idx = visibleActions.findIndex((a) => a.id === action.id);
			const isExpanded = expandedActionId === action.id;

			const row = list.createDiv(css.cls("action-manager-row"));
			row.setAttribute("data-testid", `${cssPrefix}action-manager-row-${action.id}`);
			if (!isVisible) css.addCls(row, "action-manager-row-hidden");

			if (isVisible && !isSearching) {
				row.setAttribute("draggable", "true");
				row.dataset["actionId"] = action.id;

				row.addEventListener("dragstart", (e) => {
					draggedId = action.id;
					css.addCls(row, "action-manager-row-dragging");
					if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
				});

				row.addEventListener("dragend", () => {
					draggedId = null;
					css.removeCls(row, "action-manager-row-dragging");
				});

				row.addEventListener("dragover", (e) => {
					e.preventDefault();
					if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
					css.addCls(row, "action-manager-row-dragover");
				});

				row.addEventListener("dragleave", () => {
					css.removeCls(row, "action-manager-row-dragover");
				});

				row.addEventListener("drop", (e) => {
					e.preventDefault();
					css.removeCls(row, "action-manager-row-dragover");
					if (!draggedId || draggedId === action.id) return;

					const currentVisible = config.getVisibleActions();
					const fromIdx = currentVisible.findIndex((a) => a.id === draggedId);
					const toIdx = currentVisible.findIndex((a) => a.id === action.id);
					if (fromIdx < 0 || toIdx < 0) return;

					if (fromIdx < toIdx) {
						for (let i = fromIdx; i < toIdx; i++) config.onMove(draggedId, 1);
					} else {
						for (let i = fromIdx; i > toIdx; i--) config.onMove(draggedId, -1);
					}

					renderManagerList(root);
				});
			}

			if (!isSearching) {
				const dragHandle = row.createDiv(css.cls("action-manager-drag"));
				if (isVisible) {
					const gripIcon = dragHandle.createEl("span", { cls: css.cls("action-manager-grip") });
					setIcon(gripIcon, "grip-vertical");
				}

				const dragControls = row.createDiv(css.cls("action-manager-arrows"));

				if (isVisible && idx > 0) {
					const upBtn = dragControls.createEl("button", { cls: css.cls("action-manager-drag-btn") });
					setIcon(upBtn, "chevron-up");
					upBtn.setAttribute("data-testid", `${cssPrefix}action-manager-up-${action.id}`);
					upBtn.addEventListener("click", () => {
						config.onMove(action.id, -1);
						renderManagerList(root);
					});
				}

				if (isVisible && idx < visibleActions.length - 1) {
					const downBtn = dragControls.createEl("button", { cls: css.cls("action-manager-drag-btn") });
					setIcon(downBtn, "chevron-down");
					downBtn.setAttribute("data-testid", `${cssPrefix}action-manager-down-${action.id}`);
					downBtn.addEventListener("click", () => {
						config.onMove(action.id, 1);
						renderManagerList(root);
					});
				}
			}

			renderManagerRowContent(row, {
				app,
				css,
				rowPrefix: "action-manager",
				testIdPrefix: cssPrefix,
				item: action,
				isVisible,
				isExpanded,
				visibleCount: visibleActions.length,
				renames: config.renames,
				iconOverrides: config.iconOverrides,
				colorOverrides: config.colorOverrides,
				onToggleExpand: () => {
					expandedActionId = isExpanded ? null : action.id;
					renderManagerList(root);
				},
				onHide: () => {
					if (config.getVisibleActions().length > 1) {
						config.onHide(action.id);
						renderManagerList(root);
					}
				},
				onRestore: () => {
					config.onRestore(action.id);
					renderManagerList(root);
				},
				onRename: config.onRename,
				onIconChange: config.onIconChange,
				onColorChange: config.onColorChange,
				rerender: () => renderManagerList(root),
			});
		}
	}
}
