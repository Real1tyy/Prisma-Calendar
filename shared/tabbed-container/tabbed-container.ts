import { createCssUtils } from "../core/css-utils";
import type { TabbedContainerConfig, TabbedContainerHandle } from "./types";

export function createTabbedContainer(container: HTMLElement, config: TabbedContainerConfig): TabbedContainerHandle {
	const { tabs, cssPrefix, onTabChange, lazy = true, tabBarContainer, tabBarInsertBefore } = config;
	const css = createCssUtils(cssPrefix);
	const rendered = new Set<string>();

	let currentIndex = clampInitial(config.initialTab ?? 0);
	let destroyed = false;

	const barParent = tabBarContainer ?? container;
	const tabBar = barParent.createDiv(css.cls("tab-bar"));
	if (tabBarInsertBefore && tabBarInsertBefore.parentElement === barParent) {
		barParent.insertBefore(tabBar, tabBarInsertBefore);
	}
	const tabContent = container.createDiv(css.cls("tab-content"));

	const buttons: HTMLElement[] = [];
	const panels: HTMLElement[] = [];

	for (const tab of tabs) {
		const button = tabBar.createEl("button", {
			text: tab.label,
			cls: css.cls("tab"),
			attr: { "data-tab-id": tab.id },
		});
		button.addEventListener("click", () => handle.switchTo(tab.id));
		buttons.push(button);

		const panel = tabContent.createDiv({
			cls: css.cls("tab-panel"),
		});
		panel.dataset.tabId = tab.id;
		css.addCls(panel, "tab-panel-hidden");
		panels.push(panel);
	}

	activateTab(currentIndex);

	function clampInitial(i: number): number {
		if (tabs.length === 0) return 0;
		if (i < 0 || i >= tabs.length) {
			console.warn(`TabbedContainer: initialTab ${i} out of bounds (0..${tabs.length - 1}), clamping`);
			return Math.max(0, Math.min(i, tabs.length - 1));
		}
		return i;
	}

	function resolveIndex(indexOrId: number | string): number {
		if (typeof indexOrId === "number") return indexOrId;
		return tabs.findIndex((t) => t.id === indexOrId);
	}

	function activateTab(index: number): void {
		if (index < 0 || index >= tabs.length) return;

		for (let i = 0; i < panels.length; i++) {
			css.addCls(panels[i], "tab-panel-hidden");
			css.removeCls(buttons[i], "tab-active");
		}

		const tab = tabs[index];
		const panel = panels[index];

		if (lazy && !rendered.has(tab.id)) {
			rendered.add(tab.id);
			void tab.render(panel);
		}

		css.removeCls(panel, "tab-panel-hidden");
		css.addCls(buttons[index], "tab-active");
		currentIndex = index;
	}

	const handle: TabbedContainerHandle = {
		switchTo(indexOrId: number | string): void {
			if (destroyed) return;
			const index = resolveIndex(indexOrId);
			if (index < 0 || index >= tabs.length || index === currentIndex) return;
			activateTab(index);
			onTabChange?.(tabs[currentIndex].id, currentIndex);
		},

		next(): void {
			if (destroyed || tabs.length === 0) return;
			const next = (currentIndex + 1) % tabs.length;
			handle.switchTo(next);
		},

		previous(): void {
			if (destroyed || tabs.length === 0) return;
			const prev = (currentIndex - 1 + tabs.length) % tabs.length;
			handle.switchTo(prev);
		},

		get activeIndex(): number {
			return currentIndex;
		},

		get activeId(): string {
			return tabs.length > 0 ? tabs[currentIndex].id : "";
		},

		get tabCount(): number {
			return tabs.length;
		},

		destroy(): void {
			if (destroyed) return;
			destroyed = true;
			for (const tab of tabs) {
				tab.cleanup?.();
			}
			tabBar.remove();
			container.empty();
		},
	};

	if (!lazy) {
		for (let i = 0; i < tabs.length; i++) {
			if (!rendered.has(tabs[i].id)) {
				rendered.add(tabs[i].id);
				void tabs[i].render(panels[i]);
			}
		}
	}

	return handle;
}
