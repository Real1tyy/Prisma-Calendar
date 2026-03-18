import { addCls, cls } from "@real1ty-obsidian-plugins";
import { type App, Modal } from "obsidian";

export class ICSImportProgressModal extends Modal {
	private progressBar!: HTMLElement;
	private statusText!: HTMLElement;
	private detailsText!: HTMLElement;
	private totalCount = 0;
	private isComplete = false;

	constructor(app: App, totalEvents: number) {
		super(app);
		this.totalCount = totalEvents;
	}

	override onOpen(): void {
		const { contentEl } = this;
		addCls(contentEl, "ics-import-progress-modal");

		contentEl.createEl("h2", { text: "Importing events" });

		this.statusText = contentEl.createDiv(cls("ics-import-status"));
		this.statusText.setText(`Importing 0 of ${this.totalCount} events...`);

		const progressContainer = contentEl.createDiv(cls("ics-import-progress-container"));
		this.progressBar = progressContainer.createDiv(cls("ics-import-progress-bar"));
		addCls(this.progressBar, "progress-0");

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

		this.progressBar.setCssProps({ width: `${percentage}%` });
		this.statusText.setText(`Importing ${current} of ${this.totalCount} events...`);

		if (eventTitle) {
			this.detailsText.setText(`Processing: ${eventTitle}`);
		}
	}

	showComplete(successCount: number, errorCount: number, skippedCount: number): void {
		this.isComplete = true;

		this.progressBar.setCssProps({ width: "100%" });
		addCls(this.progressBar, "complete");

		this.statusText.setText("Import complete");

		const parts: string[] = [];
		if (successCount > 0) parts.push(`✓ ${successCount} imported`);
		if (skippedCount > 0) parts.push(`⊘ ${skippedCount} skipped (already exist)`);
		if (errorCount > 0) parts.push(`✗ ${errorCount} failed`);
		this.detailsText.setText(parts.join("  •  "));

		setTimeout(() => {
			this.close();
		}, 2000);
	}

	showError(message: string): void {
		this.isComplete = true;

		addCls(this.progressBar, "error");
		this.statusText.setText("Import failed");
		this.detailsText.setText(message);

		setTimeout(() => {
			this.close();
		}, 3000);
	}

	override onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
