import type { CategoryOperationResult } from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice, TFile } from "obsidian";
import type { CategoryTracker } from "../../core/category-tracker";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { CalendarEvent } from "../../types/calendar";

export abstract class BaseCategoryOperationModal extends Modal {
	protected actionButton: HTMLButtonElement | null = null;

	constructor(
		app: App,
		protected categoryTracker: CategoryTracker,
		protected settingsStore: CalendarSettingsStore,
		protected categoryName: string,
		protected onSuccess: () => void
	) {
		super(app);
	}

	abstract getModalTitle(): string;
	abstract getModalCssClass(): string;
	abstract renderModalContent(contentEl: HTMLElement, eventsWithCategory: CalendarEvent[]): void;
	abstract getActionButtonText(): string;
	abstract getActionButtonClass(): string;
	abstract getProgressText(): string;
	abstract performOperation(files: TFile[]): Promise<CategoryOperationResult>;
	abstract updateColorRules(categoryProp: string): Promise<void>;
	abstract getSuccessMessage(filesModified: number): string;
	abstract getErrorMessage(error: unknown): string;

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass(this.getModalCssClass());

		contentEl.createEl("h2", { text: this.getModalTitle() });

		const eventsWithCategory = this.categoryTracker.getEventsWithCategory(this.categoryName);

		this.renderModalContent(contentEl, eventsWithCategory);

		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		this.actionButton = buttonContainer.createEl("button", {
			text: this.getActionButtonText(),
			cls: this.getActionButtonClass(),
		});
		this.actionButton.addEventListener("click", () => {
			void this.handleOperation();
		});
	}

	protected async handleOperation(): Promise<void> {
		if (!this.actionButton) return;

		this.actionButton.disabled = true;
		this.actionButton.setText(this.getProgressText());

		try {
			const settings = this.settingsStore.currentSettings;
			const eventsWithCategory = this.categoryTracker.getEventsWithCategory(this.categoryName);
			const filePaths = eventsWithCategory.map((event) => event.ref.filePath);
			const files = filePaths
				.map((path) => this.app.vault.getAbstractFileByPath(path))
				.filter((file): file is TFile => file instanceof TFile);

			const result = await this.performOperation(files);

			await this.updateColorRules(settings.categoryProp);

			if (result.filesWithErrors.length > 0) {
				new Notice(
					`${this.getSuccessMessage(result.filesModified.length)}, but ${result.filesWithErrors.length} failed. Check console for details.`
				);
				console.error(`Errors in category operation:`, result.filesWithErrors);
			} else {
				new Notice(this.getSuccessMessage(result.filesModified.length));
			}

			this.close();
		} catch (error) {
			new Notice(this.getErrorMessage(error));
			console.error("Error in category operation:", error);
			if (this.actionButton) {
				this.actionButton.disabled = false;
				this.actionButton.setText(this.getActionButtonText());
			}
		}
	}

	protected getCategoryExpression(category: string, categoryProp: string): string {
		const escapedCategory = category.replace(/'/g, "\\'");
		return `${categoryProp}.includes('${escapedCategory}')`;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
