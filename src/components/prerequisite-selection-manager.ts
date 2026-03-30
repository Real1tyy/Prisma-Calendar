import type { Calendar } from "@fullcalendar/core";
import { addCls, cls, extractDisplayName, parseIntoList, toDisplayLink } from "@real1ty-obsidian-plugins";
import { type App, Notice } from "obsidian";

import type { CalendarBundle } from "../core/calendar-bundle";
import { assignPrerequisites } from "../core/commands";
import { getFileAndFrontmatter } from "../utils/obsidian";

export class PrerequisiteSelectionManager {
	private targetFilePath: string | null = null;
	private existingPrereqs: string[] = [];
	private isActive = false;
	private bannerEl: HTMLElement | null = null;
	private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(
		private app: App,
		private calendar: Calendar,
		private bundle: CalendarBundle,
		private container: HTMLElement
	) {}

	// ─── Selection Mode ───────────────────────────────────────────

	enter(targetFilePath: string): void {
		if (this.isActive) this.exit();

		this.targetFilePath = targetFilePath;
		this.isActive = true;

		const { frontmatter } = getFileAndFrontmatter(this.app, targetFilePath);
		const settings = this.bundle.settingsStore.currentSettings;
		this.existingPrereqs = parseIntoList(frontmatter[settings.prerequisiteProp], { splitCommas: false });

		this.showBanner();
		this.registerEscapeHandler();
	}

	exit(): void {
		this.isActive = false;
		this.targetFilePath = null;
		this.existingPrereqs = [];

		this.removeBanner();
		this.unregisterEscapeHandler();
	}

	isInSelectionMode(): boolean {
		return this.isActive;
	}

	// ─── Event Handling ───────────────────────────────────────────

	handleEventClick(eventId: string): void {
		if (!this.isActive || !this.targetFilePath) return;

		const fcEvent = this.calendar.getEventById(eventId);
		if (!fcEvent) return;

		const filePath = fcEvent.extendedProps["filePath"] as string | undefined;
		if (!filePath) return;

		if (filePath === this.targetFilePath) {
			new Notice("Cannot assign an event as its own prerequisite");
			return;
		}

		const wikiLink = toDisplayLink(filePath);
		const targetFilePath = this.targetFilePath;
		const updatedPrereqs = this.existingPrereqs.includes(wikiLink)
			? this.existingPrereqs
			: [...this.existingPrereqs, wikiLink];

		this.exit();
		void this.save(targetFilePath, updatedPrereqs);
	}

	// ─── Save ─────────────────────────────────────────────────────

	private async save(targetFilePath: string, prerequisites: string[]): Promise<void> {
		try {
			const command = assignPrerequisites(this.app, this.bundle, targetFilePath, prerequisites);
			await this.bundle.commandManager.executeCommand(command);
			new Notice("Prerequisite assigned");
		} catch (error) {
			console.error("[PrerequisiteSelection] Failed to assign prerequisite:", error);
			new Notice("Failed to assign prerequisite");
		}
	}

	// ─── Banner UI ────────────────────────────────────────────────

	private showBanner(): void {
		const targetName = this.targetFilePath ? extractDisplayName(this.targetFilePath) : "event";

		this.bannerEl = this.container.createDiv(cls("prereq-selection-banner"));

		const textEl = this.bannerEl.createDiv(cls("prereq-selection-banner-text"));
		textEl.setText(`Click an event to assign it as a prerequisite for "${targetName}"`);

		const cancelBtn = this.bannerEl.createEl("button", { text: "Cancel" });
		addCls(cancelBtn, "prereq-selection-btn");
		cancelBtn.addEventListener("click", () => {
			this.exit();
			new Notice("Prerequisite selection cancelled");
		});
	}

	private removeBanner(): void {
		this.bannerEl?.remove();
		this.bannerEl = null;
	}

	// ─── Keyboard ─────────────────────────────────────────────────

	private registerEscapeHandler(): void {
		this.escapeHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape" && this.isActive) {
				e.preventDefault();
				e.stopPropagation();
				this.exit();
				new Notice("Prerequisite selection cancelled");
			}
		};
		document.addEventListener("keydown", this.escapeHandler, true);
	}

	private unregisterEscapeHandler(): void {
		if (this.escapeHandler) {
			document.removeEventListener("keydown", this.escapeHandler, true);
			this.escapeHandler = null;
		}
	}
}
