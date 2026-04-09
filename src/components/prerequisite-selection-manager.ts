import type { Calendar } from "@fullcalendar/core";
import { Notice } from "obsidian";

import type { CalendarBundle } from "../core/calendar-bundle";
import { addPrerequisite } from "../core/commands";
import { extractCleanDisplayName } from "../utils/event-naming";
import { getFilePath } from "../utils/extended-props";
import { createStickyBanner, type StickyBannerHandle } from "./sticky-banner";

export class PrerequisiteSelectionManager {
	private targetFilePath: string | null = null;
	private isActive = false;
	private banner: StickyBannerHandle | null = null;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(
		private calendar: Calendar,
		private bundle: CalendarBundle,
		private container: HTMLElement
	) {}

	// ─── Selection Mode ───────────────────────────────────────────

	enter(targetFilePath: string): void {
		if (this.isActive) this.exit();

		this.targetFilePath = targetFilePath;
		this.isActive = true;

		const targetName = extractCleanDisplayName(targetFilePath);
		this.banner = createStickyBanner(
			this.container,
			`Click an event to assign it as a prerequisite for "${targetName}"`,
			() => {
				this.exit();
				new Notice("Prerequisite selection cancelled");
			}
		);
	}

	exit(): void {
		this.isActive = false;
		this.targetFilePath = null;

		this.banner?.destroy();
		this.banner = null;
	}

	isInSelectionMode(): boolean {
		return this.isActive;
	}

	// ─── Event Handling ───────────────────────────────────────────

	handleEventClick(eventId: string): void {
		if (!this.isActive || !this.targetFilePath) return;

		const fcEvent = this.calendar.getEventById(eventId);
		if (!fcEvent) return;

		const filePath = getFilePath(fcEvent);
		if (!filePath) return;

		if (filePath === this.targetFilePath) {
			new Notice("Cannot assign an event as its own prerequisite");
			return;
		}

		const command = addPrerequisite(this.bundle, this.targetFilePath, filePath);
		this.exit();

		void (async () => {
			try {
				await this.bundle.commandManager.executeCommand(command);
				new Notice("Prerequisite assigned");
			} catch (error) {
				console.error("[PrerequisiteSelection] Failed to assign prerequisite:", error);
				new Notice("Failed to assign prerequisite");
			}
		})();
	}
}
