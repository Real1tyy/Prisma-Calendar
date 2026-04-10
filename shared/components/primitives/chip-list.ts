import { createCssUtils } from "../../utils/css-utils";
import { injectStyleSheet } from "../../utils/styles/inject";

// ─── Types ───

export interface ChipListConfig {
	/** CSS prefix for all class names (e.g. "prisma-") */
	cssPrefix: string;
	/** Text shown when the list is empty (default: "No items") */
	emptyText?: string;
	/** Transform an item value into a display label */
	getDisplayName?: (item: string) => string;
	/** Generate tooltip text for an item */
	getTooltip?: (item: string) => string;
	/** Render custom content before the chip label (e.g. color dot) */
	renderPrefix?: (chipEl: HTMLElement, item: string) => void;
	/** Click handler for the chip label */
	onNameClick?: (item: string) => void;
	/** Called after any user-initiated mutation (add/remove via UI) */
	onChange?: () => void;
}

// ─── Defaults ───

const DEFAULT_EMPTY_TEXT = "No items";

// ─── CSS Class Suffixes ───

const LIST_SUFFIX = "chip-list";
const ITEM_SUFFIX = "chip-item";
const NAME_SUFFIX = "chip-name";
const REMOVE_SUFFIX = "chip-remove";
const EMPTY_SUFFIX = "chip-empty";

// ─── Styles ───

function buildChipListStyles(p: string): string {
	return `
.${p}${LIST_SUFFIX} {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	min-height: 2rem;
	align-items: center;
	flex: 1;
	min-width: 0;
}

.${p}${EMPTY_SUFFIX} {
	color: var(--text-muted);
	font-style: italic;
}

.${p}${ITEM_SUFFIX} {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.3rem 0.6rem;
	background-color: var(--background-modifier-form-field);
	border: 1px solid var(--background-modifier-border);
	border-radius: 4px;
	transition: background-color 0.15s ease, border-color 0.15s ease;
}

.${p}${ITEM_SUFFIX}:hover {
	background-color: var(--background-modifier-hover);
	border-color: var(--interactive-accent);
}

.${p}${NAME_SUFFIX} {
	font-size: var(--font-ui-medium);
	color: var(--text-normal);
	cursor: pointer;
}

.${p}${REMOVE_SUFFIX} {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1rem;
	height: 1rem;
	font-size: 0.8em;
	font-weight: bold;
	color: var(--text-muted);
	background-color: transparent;
	cursor: pointer;
	border-radius: 2px;
	transition: color 0.15s ease, background-color 0.15s ease;
}

.${p}${REMOVE_SUFFIX}:hover {
	color: var(--text-error);
	background-color: var(--background-modifier-error);
}
`;
}

// ─── Component ───

export class ChipList {
	readonly el: HTMLElement;
	private items: string[] = [];
	private readonly config: ChipListConfig;
	private readonly css;

	constructor(config: ChipListConfig) {
		this.config = config;
		this.css = createCssUtils(config.cssPrefix);

		injectStyleSheet(`${config.cssPrefix}chip-list-styles`, buildChipListStyles(config.cssPrefix));

		this.el = createDiv(this.css.cls(LIST_SUFFIX));
		this.render();
	}

	get value(): string[] {
		return [...this.items];
	}

	setItems(items: string[]): void {
		this.items = [...items];
		this.render();
	}

	add(item: string): void {
		if (this.items.includes(item)) return;
		this.items.push(item);
		this.render();
		this.config.onChange?.();
	}

	remove(item: string): void {
		this.items = this.items.filter((i) => i !== item);
		this.render();
		this.config.onChange?.();
	}

	updateConfig(partial: Partial<Omit<ChipListConfig, "cssPrefix">>): void {
		Object.assign(this.config, partial);
		this.render();
	}

	private render(): void {
		this.el.empty();

		if (this.items.length === 0) {
			this.el.createEl("span", {
				text: this.config.emptyText ?? DEFAULT_EMPTY_TEXT,
				cls: this.css.cls(EMPTY_SUFFIX),
			});
			return;
		}

		for (const item of this.items) {
			const chipEl = this.el.createDiv(this.css.cls(ITEM_SUFFIX));

			this.config.renderPrefix?.(chipEl, item);

			const displayName = this.config.getDisplayName?.(item) ?? item;
			const nameSpan = chipEl.createEl("span", {
				text: displayName,
				cls: this.css.cls(NAME_SUFFIX),
			});

			const tooltip = this.config.getTooltip?.(item);
			if (tooltip) {
				nameSpan.setAttribute("title", tooltip);
			}

			if (this.config.onNameClick) {
				const handler = this.config.onNameClick;
				nameSpan.addEventListener("click", () => handler(item));
			}

			const removeButton = chipEl.createEl("span", {
				text: "\u00D7",
				cls: this.css.cls(REMOVE_SUFFIX),
			});
			removeButton.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.remove(item);
			});
		}
	}
}
