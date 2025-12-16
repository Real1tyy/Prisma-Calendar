import { addCls, cls } from "@real1ty-obsidian-plugins/utils";
import { type App, Modal } from "obsidian";

export class ICSImportProgressModal extends Modal {
	private progressBar: HTMLElement | null = null;
	private statusText: HTMLElement | null = null;
	private detailsText: HTMLElement | null = null;
	private totalCount = 0;
	private isComplete = false;

	constructor(app: App, totalEvents: number) {
		super(app);
		this.totalCount = totalEvents;
	}

	onOpen(): void {
		const { contentEl } = this;
		addCls(contentEl, "ics-import-progress-modal");

		contentEl.createEl("h2", { text: "Importing Events" });

		this.statusText = contentEl.createDiv(cls("ics-import-status"));
		this.statusText.setText(`Importing 0 of ${this.totalCount} events...`);

		const progressContainer = contentEl.createDiv(cls("ics-import-progress-container"));
		this.progressBar = progressContainer.createDiv(cls("ics-import-progress-bar"));
		this.progressBar.style.width = "0%";

		this.detailsText = contentEl.createDiv(cls("ics-import-details"));
		this.detailsText.setText("Starting import...");

		this.modalEl.addEventListener("click", (e) => {
			if (!this.isComplete && e.target === this.modalEl) {
				e.stopPropagation();
			}
		});
	}

	updateProgress(current: number, eventTitle?: string): void {
		const percentage = Math.round((current / this.totalCount) * 100);

		if (this.progressBar) {
			this.progressBar.style.width = `${percentage}%`;
		}

		if (this.statusText) {
			this.statusText.setText(`Importing ${current} of ${this.totalCount} events...`);
		}

		if (this.detailsText && eventTitle) {
			this.detailsText.setText(`Processing: ${eventTitle}`);
		}
	}

	showComplete(successCount: number, errorCount: number, skippedCount: number): void {
		this.isComplete = true;

		if (this.progressBar) {
			this.progressBar.style.width = "100%";
			addCls(this.progressBar, "complete");
		}

		if (this.statusText) {
			this.statusText.setText("Import Complete!");
		}

		if (this.detailsText) {
			const parts: string[] = [];
			if (successCount > 0) parts.push(`✓ ${successCount} imported`);
			if (skippedCount > 0) parts.push(`⊘ ${skippedCount} skipped (already exist)`);
			if (errorCount > 0) parts.push(`✗ ${errorCount} failed`);
			this.detailsText.setText(parts.join("  •  "));
		}

		setTimeout(() => {
			this.close();
		}, 2000);
	}

	showError(message: string): void {
		this.isComplete = true;

		if (this.progressBar) {
			addCls(this.progressBar, "error");
		}

		if (this.statusText) {
			this.statusText.setText("Import Failed");
		}

		if (this.detailsText) {
			this.detailsText.setText(message);
		}

		setTimeout(() => {
			this.close();
		}, 3000);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
