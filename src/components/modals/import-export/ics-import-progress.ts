import { addCls, cls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

export interface ICSImportProgressHandle {
	updateProgress: (current: number, eventTitle?: string) => void;
	showComplete: (successCount: number, errorCount: number, skippedCount: number) => void;
	showError: (message: string) => void;
}

export function showICSImportProgressModal(app: App, totalEvents: number): ICSImportProgressHandle {
	let progressBar: HTMLElement;
	let statusText: HTMLElement;
	let detailsText: HTMLElement;
	let isComplete = false;
	let closeModal: (() => void) | null = null;

	showModal({
		app,
		cls: cls("ics-import-progress-modal"),
		render: (el, ctx) => {
			closeModal = ctx.close;

			el.createEl("h2", { text: "Importing events" });

			statusText = el.createDiv(cls("ics-import-status"));
			statusText.setText(`Importing 0 of ${totalEvents} events...`);

			const progressContainer = el.createDiv(cls("ics-import-progress-container"));
			progressBar = progressContainer.createDiv(cls("ics-import-progress-bar"));
			addCls(progressBar, "progress-0");

			detailsText = el.createDiv(cls("ics-import-details"));
			detailsText.setText("Starting import...");

			if (ctx.type === "modal") {
				ctx.modalEl.addEventListener("click", (e) => {
					if (!isComplete && e.target === ctx.modalEl) {
						e.stopPropagation();
					}
				});
			}
		},
	});

	return {
		updateProgress(current: number, eventTitle?: string): void {
			const percentage = Math.round((current / totalEvents) * 100);
			progressBar?.setCssProps({ width: `${percentage}%` });
			statusText?.setText(`Importing ${current} of ${totalEvents} events...`);
			if (eventTitle) {
				detailsText?.setText(`Processing: ${eventTitle}`);
			}
		},

		showComplete(successCount: number, errorCount: number, skippedCount: number): void {
			isComplete = true;
			progressBar?.setCssProps({ width: "100%" });
			if (progressBar) addCls(progressBar, "complete");
			statusText?.setText("Import complete");

			const parts: string[] = [];
			if (successCount > 0) parts.push(`✓ ${successCount} imported`);
			if (skippedCount > 0) parts.push(`⊘ ${skippedCount} skipped (already exist)`);
			if (errorCount > 0) parts.push(`✗ ${errorCount} failed`);
			detailsText?.setText(parts.join("  •  "));

			setTimeout(() => closeModal?.(), 2000);
		},

		showError(message: string): void {
			isComplete = true;
			if (progressBar) addCls(progressBar, "error");
			statusText?.setText("Import failed");
			detailsText?.setText(message);

			setTimeout(() => closeModal?.(), 3000);
		},
	};
}
