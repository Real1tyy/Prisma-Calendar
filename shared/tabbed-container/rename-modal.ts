import type { App } from "obsidian";

import { showModal } from "../component-renderer/modal";
import type { CssUtils } from "../core/css-utils";

export interface RenameOps {
	currentLabel: string;
	originalLabel: string;
	hasRename: boolean;
	save: (label: string) => void;
	reset: () => void;
}

export function openRenameModal(
	app: App,
	css: CssUtils,
	ops: RenameOps,
	rebuild: () => void,
	onDone?: () => void
): void {
	showModal({
		app,
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
