import { type App, Modal } from "obsidian";

import type { FrontmatterDiff } from "../file/frontmatter-diff";
import { formatChangeForDisplay } from "../file/frontmatter-diff";

export interface FrontmatterPropagationModalOptions {
	eventTitle: string;
	diff: FrontmatterDiff;
	instanceCount: number;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
	cssPrefix?: string;
}

export class FrontmatterPropagationModal extends Modal {
	private options: FrontmatterPropagationModalOptions;

	constructor(app: App, options: FrontmatterPropagationModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		const prefix = this.options.cssPrefix ?? "frontmatter-propagation";

		contentEl.empty();

		contentEl.createEl("h2", { text: "Propagate frontmatter changes?" });

		contentEl.createEl("p", {
			text: `The recurring event "${this.options.eventTitle}" has frontmatter changes. Do you want to apply these changes to all ${this.options.instanceCount} instances?`,
		});

		const changesContainer = contentEl.createDiv({ cls: `${prefix}-frontmatter-changes` });

		if (this.options.diff.added.length > 0) {
			const addedSection = changesContainer.createDiv({
				cls: `${prefix}-frontmatter-changes-section`,
			});
			addedSection.createEl("h4", { text: "Added properties:" });
			const addedList = addedSection.createEl("ul");

			for (const change of this.options.diff.added) {
				addedList.createEl("li", {
					text: formatChangeForDisplay(change),
					cls: `${prefix}-change-added`,
				});
			}
		}

		if (this.options.diff.modified.length > 0) {
			const modifiedSection = changesContainer.createDiv({ cls: `${prefix}-changes-section` });
			modifiedSection.createEl("h4", { text: "Modified properties:" });
			const modifiedList = modifiedSection.createEl("ul");

			for (const change of this.options.diff.modified) {
				modifiedList.createEl("li", {
					text: formatChangeForDisplay(change),
					cls: `${prefix}-change-modified`,
				});
			}
		}

		if (this.options.diff.deleted.length > 0) {
			const deletedSection = changesContainer.createDiv({ cls: `${prefix}-changes-section` });
			deletedSection.createEl("h4", { text: "Deleted properties:" });
			const deletedList = deletedSection.createEl("ul");

			for (const change of this.options.diff.deleted) {
				deletedList.createEl("li", {
					text: formatChangeForDisplay(change),
					cls: `${prefix}-change-deleted`,
				});
			}
		}

		const buttonContainer = contentEl.createDiv({ cls: `${prefix}-modal-buttons` });

		const yesButton = buttonContainer.createEl("button", {
			text: "Yes, propagate",
			cls: "mod-cta",
		});

		yesButton.addEventListener("click", () => {
			void Promise.resolve(this.options.onConfirm())
				.then(() => {
					this.close();
				})
				.catch((error) => {
					console.error("Error in onConfirm callback:", error);
					this.close();
				});
		});

		const noButton = buttonContainer.createEl("button", { text: "No, skip" });

		noButton.addEventListener("click", () => {
			const result = this.options.onCancel?.();

			if (result instanceof Promise) {
				void result.catch((error) => {
					console.error("Error in onCancel callback:", error);
				});
			}

			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
