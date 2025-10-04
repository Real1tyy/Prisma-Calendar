import { DateTime } from "luxon";
import { type App, Modal, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";
import { ToggleSkipCommand } from "../core/commands";
import type { ParsedEvent } from "../core/parser";
import { formatDurationHumanReadable } from "../utils/format";

export class SkippedEventsModal extends Modal {
	private closeCallback?: () => void;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private skippedEvents: ParsedEvent[],
		closeCallback?: () => void
	) {
		super(app);
		this.closeCallback = closeCallback;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("skipped-events-modal");

		// Register keyboard shortcut to close modal
		this.scope.register([], "Escape", () => {
			this.close();
			return false;
		});

		// Listen for the show-skipped-events command hotkey to toggle close
		if (this.closeCallback) {
			const hotkeys = (this.app as any).hotkeyManager?.getHotkeys(FULL_COMMAND_IDS.SHOW_SKIPPED_EVENTS);
			if (hotkeys && hotkeys.length > 0) {
				for (const hotkey of hotkeys) {
					this.scope.register(hotkey.modifiers, hotkey.key, () => {
						if (this.closeCallback) {
							this.closeCallback();
						}
						return false;
					});
				}
			}
		}

		// Title
		contentEl.createEl("h2", { text: "Skipped Events" });

		if (this.skippedEvents.length === 0) {
			contentEl.createEl("p", { text: "No skipped events in the current view." });
			return;
		}

		// Count
		contentEl.createEl("p", {
			text: `${this.skippedEvents.length} event${this.skippedEvents.length === 1 ? "" : "s"} currently skipped`,
			cls: "skipped-count",
		});

		// Event list
		const listEl = contentEl.createEl("div", { cls: "skipped-events-list" });

		for (const event of this.skippedEvents) {
			this.createEventItem(listEl, event);
		}
	}

	private createEventItem(container: HTMLElement, event: ParsedEvent): void {
		const itemEl = container.createEl("div", { cls: "skipped-event-item" });

		// Event info
		const infoEl = itemEl.createEl("div", { cls: "event-info" });

		// Title
		infoEl.createEl("div", { text: event.title, cls: "event-title" });

		// Time info
		const timeEl = infoEl.createEl("div", { cls: "event-time" });

		const startTime = DateTime.fromISO(event.start);
		if (event.allDay) {
			timeEl.textContent = `All Day - ${startTime.toFormat("MMM d, yyyy")}`;
		} else {
			const endTime = event.end ? DateTime.fromISO(event.end) : null;
			if (endTime) {
				const durationText = formatDurationHumanReadable(startTime, endTime);
				timeEl.textContent = `${startTime.toFormat("MMM d, yyyy - h:mm a")} (${durationText})`;
			} else {
				timeEl.textContent = startTime.toFormat("MMM d, yyyy - h:mm a");
			}
		}

		// Action buttons
		const actionsEl = itemEl.createEl("div", { cls: "event-actions" });

		// Un-skip button
		const unskipBtn = actionsEl.createEl("button", { text: "Un-skip" });
		unskipBtn.addClass("mod-cta");
		unskipBtn.addEventListener("click", async () => {
			await this.handleUnskip(event, itemEl);
		});

		// Open file button
		const openBtn = actionsEl.createEl("button", { text: "Open" });
		openBtn.addEventListener("click", () => {
			this.app.workspace.openLinkText(event.ref.filePath, "", false);
		});
	}

	private async handleUnskip(event: ParsedEvent, itemEl: HTMLElement): Promise<void> {
		try {
			const command = new ToggleSkipCommand(this.app, this.bundle, event.ref.filePath);
			await this.bundle.commandManager.executeCommand(command);

			// Remove the item from the list with animation
			itemEl.style.opacity = "0";

			setTimeout(() => {
				itemEl.remove();

				// Update remaining events
				this.skippedEvents = this.skippedEvents.filter((e) => e.id !== event.id);

				// Update count or close if empty
				const countEl = this.contentEl.querySelector(".skipped-count");
				if (countEl && this.skippedEvents.length > 0) {
					countEl.textContent = `${this.skippedEvents.length} event${this.skippedEvents.length === 1 ? "" : "s"} currently skipped`;
				} else if (this.skippedEvents.length === 0) {
					new Notice("All events un-skipped!");
					this.close();
				}
			}, 200);

			new Notice("Event un-skipped");
		} catch (error) {
			console.error("Failed to un-skip event:", error);
			new Notice("Failed to un-skip event");
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
