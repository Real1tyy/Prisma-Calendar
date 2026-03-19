import { cls } from "@real1ty-obsidian-plugins";

export interface ChipListConfig {
	container: HTMLElement;
	items: string[];
	emptyText: string;
	getDisplayName?: (item: string) => string;
	getTooltip?: (item: string) => string;
	renderPrefix?: (chipEl: HTMLElement, item: string) => void;
	onNameClick?: (item: string) => void;
	onRemove: (item: string) => void;
}

export function renderChipList(config: ChipListConfig): void {
	config.container.empty();

	if (config.items.length === 0) {
		config.container.createEl("span", {
			text: config.emptyText,
			cls: cls("no-categories-text"),
		});
		return;
	}

	for (const item of config.items) {
		const chipEl = config.container.createDiv(cls("category-item"));

		config.renderPrefix?.(chipEl, item);

		const displayName = config.getDisplayName?.(item) ?? item;
		const nameSpan = chipEl.createEl("span", {
			text: displayName,
			cls: cls("category-name"),
		});

		const tooltip = config.getTooltip?.(item);
		if (tooltip) {
			nameSpan.setAttribute("title", tooltip);
		}

		if (config.onNameClick) {
			const handler = config.onNameClick;
			nameSpan.addEventListener("click", () => handler(item));
		}

		const removeButton = chipEl.createEl("span", {
			text: "\u00D7",
			cls: cls("category-remove-button"),
		});
		removeButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			config.onRemove(item);
		});
	}
}
