import type { App } from "obsidian";

import type { FrontmatterDiff } from "../../core/frontmatter/frontmatter-diff";
import { formatChangeForDisplay } from "../../core/frontmatter/frontmatter-diff";
import { showConfirmationModal } from "../component-renderer/confirmation";

export interface FrontmatterPropagationModalOptions {
	eventTitle: string;
	diff: FrontmatterDiff;
	instanceCount: number;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
	cssPrefix?: string;
}

function renderDiffSection(
	parent: HTMLElement,
	prefix: string,
	title: string,
	changes: unknown[],
	changeCls: string
): void {
	if (changes.length === 0) return;

	const section = parent.createDiv({ cls: `${prefix}-frontmatter-changes-section` });
	section.createEl("h4", { text: title });
	const list = section.createEl("ul");

	for (const change of changes) {
		list.createEl("li", {
			text: formatChangeForDisplay(change as Parameters<typeof formatChangeForDisplay>[0]),
			cls: `${prefix}-${changeCls}`,
		});
	}
}

export function showFrontmatterPropagationModal(app: App, options: FrontmatterPropagationModalOptions): void {
	const prefix = options.cssPrefix ?? "frontmatter-propagation";

	showConfirmationModal(app, {
		title: "Propagate frontmatter changes?",
		cls: `${prefix}-modal`,
		message: (el) => {
			el.createEl("p", {
				text: `The recurring event "${options.eventTitle}" has frontmatter changes. Do you want to apply these changes to all ${options.instanceCount} instances?`,
			});

			const changesContainer = el.createDiv({ cls: `${prefix}-frontmatter-changes` });
			renderDiffSection(changesContainer, prefix, "Added properties:", options.diff.added, "change-added");
			renderDiffSection(changesContainer, prefix, "Modified properties:", options.diff.modified, "change-modified");
			renderDiffSection(changesContainer, prefix, "Deleted properties:", options.diff.deleted, "change-deleted");
		},
		confirmButton: "Yes, propagate",
		cancelButton: "No, skip",
		onConfirm: options.onConfirm,
		...(options.onCancel ? { onCancel: options.onCancel } : {}),
	});
}
