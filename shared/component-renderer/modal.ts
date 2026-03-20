import { Modal } from "obsidian";

import { createCssUtils } from "../core/css-utils";
import { injectStyleSheet } from "../styles/inject";
import type { ModalComponentConfig, ModalContext } from "./types";

const SEARCH_SUFFIX = "modal-search";
const SEARCH_INPUT_SUFFIX = "modal-search-input";
const SEARCH_CONTENT_SUFFIX = "modal-search-content";
const SEARCH_EMPTY_SUFFIX = "modal-search-empty";

function buildSearchStyles(p: string): string {
	return `
.${p}${SEARCH_SUFFIX} {
	margin-bottom: 8px;
}

.${p}${SEARCH_INPUT_SUFFIX} {
	width: 100%;
	padding: 8px 12px;
	font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background: var(--background-secondary);
	color: var(--text-normal);
}

.${p}${SEARCH_INPUT_SUFFIX}:focus {
	border-color: var(--interactive-accent);
	outline: none;
}

.${p}${SEARCH_INPUT_SUFFIX}::placeholder {
	color: var(--text-faint);
}

.${p}${SEARCH_EMPTY_SUFFIX} {
	text-align: center;
	padding: 16px;
	color: var(--text-faint);
	font-size: var(--font-ui-medium);
}
`;
}

export function showModal(config: ModalComponentConfig): void {
	class ComponentModal extends Modal {
		override async onOpen(): Promise<void> {
			const { contentEl, modalEl } = this;
			modalEl.addClass(config.cls);
			if (config.title) this.setTitle(config.title);

			const ctx: ModalContext = {
				type: "modal",
				app: this.app,
				close: () => this.close(),
				modalEl,
				scope: this.scope,
				searchQuery: "",
			};

			if (config.search) {
				const { cssPrefix } = config.search;
				const css = createCssUtils(cssPrefix);

				injectStyleSheet(`${cssPrefix}modal-search-styles`, buildSearchStyles(cssPrefix));

				const searchContainer = contentEl.createDiv(css.cls(SEARCH_SUFFIX));
				const input = searchContainer.createEl("input", {
					type: "text",
					placeholder: config.search.placeholder ?? "Search...",
					cls: css.cls(SEARCH_INPUT_SUFFIX),
				});

				const contentArea = contentEl.createDiv(css.cls(SEARCH_CONTENT_SUFFIX));
				await config.render(contentArea, ctx);

				input.addEventListener("input", async () => {
					ctx.searchQuery = input.value.toLowerCase();
					contentArea.empty();
					await config.render(contentArea, ctx);
				});
			} else {
				await config.render(contentEl, ctx);
			}
		}

		override onClose(): void {
			config.cleanup?.();
			this.contentEl.empty();
		}
	}

	new ComponentModal(config.app).open();
}
