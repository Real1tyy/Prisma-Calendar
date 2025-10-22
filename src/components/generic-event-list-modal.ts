import { DateTime } from "luxon";
import { type App, Modal, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";
import { ToggleSkipCommand } from "../core/commands";
import type { ParsedEvent } from "../core/parser";
import { removeZettelId } from "../utils/calendar-events";
import { formatDurationHumanReadable } from "../utils/format";

export interface EventListItem {
	id?: string; // Optional unique identifier (used for skipped events)
	filePath: string;
	title: string;
	subtitle?: string; // Optional secondary info (e.g., date, path)
}

export interface EventListAction {
	label: string;
	icon?: string;
	isPrimary?: boolean; // Uses mod-cta styling
	handler: (item: EventListItem, itemEl: HTMLElement) => Promise<void> | void;
}

export interface EventListModalConfig {
	title: string;
	emptyMessage: string;
	countSuffix?: string; // Optional suffix for count text (e.g., "currently skipped")
	items: EventListItem[];
	actions: EventListAction[];
	closeCallback?: () => void;
	hotkeyCommandId?: string;
	onItemClick?: (item: EventListItem) => void;
	successMessage?: string; // Optional message shown when all items are processed
}

export class GenericEventListModal extends Modal {
	private config: EventListModalConfig;

	constructor(app: App, config: EventListModalConfig) {
		super(app);
		this.config = config;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("generic-event-list-modal");

		// Register keyboard shortcut to close modal
		this.scope.register([], "Escape", () => {
			this.close();
			return false;
		});

		// Listen for command hotkey to toggle close
		if (this.config.closeCallback && this.config.hotkeyCommandId) {
			const hotkeys = (this.app as any).hotkeyManager?.getHotkeys(this.config.hotkeyCommandId);
			if (hotkeys && hotkeys.length > 0) {
				for (const hotkey of hotkeys) {
					this.scope.register(hotkey.modifiers, hotkey.key, () => {
						if (this.config.closeCallback) {
							this.config.closeCallback();
						}
						return false;
					});
				}
			}
		}

		// Title
		contentEl.createEl("h2", { text: this.config.title });

		if (this.config.items.length === 0) {
			contentEl.createEl("p", { text: this.config.emptyMessage });
			return;
		}

		// Count
		const countText = this.config.countSuffix
			? `${this.config.items.length} event${this.config.items.length === 1 ? "" : "s"} ${this.config.countSuffix}`
			: `${this.config.items.length} event${this.config.items.length === 1 ? "" : "s"}`;
		contentEl.createEl("p", {
			text: countText,
			cls: "generic-event-list-count",
		});

		// Event list
		const listEl = contentEl.createEl("div", { cls: "generic-event-list" });

		for (const item of this.config.items) {
			this.createEventItem(listEl, item);
		}
	}

	private createEventItem(container: HTMLElement, item: EventListItem): void {
		const itemEl = container.createEl("div", { cls: "generic-event-list-item" });

		// Event info
		const infoEl = itemEl.createEl("div", { cls: "generic-event-info" });

		// Title
		const titleEl = infoEl.createEl("div", { cls: "generic-event-title" });
		const cleanTitle = removeZettelId(item.title);
		titleEl.textContent = cleanTitle;

		// Subtitle (time/path info)
		if (item.subtitle) {
			const subtitleEl = infoEl.createEl("div", { cls: "generic-event-subtitle" });
			subtitleEl.textContent = item.subtitle;
		}

		// Action buttons
		if (this.config.actions.length > 0) {
			const actionsEl = itemEl.createEl("div", { cls: "generic-event-actions" });

			for (const action of this.config.actions) {
				const btn = actionsEl.createEl("button", { text: action.label });
				if (action.isPrimary) {
					btn.addClass("mod-cta");
				}
				btn.addEventListener("click", async (e) => {
					e.stopPropagation(); // Prevent triggering item click
					await action.handler(item, itemEl);
				});
			}
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	// Helper method for removing items with animation
	removeItem(itemEl: HTMLElement, item: EventListItem): void {
		itemEl.style.opacity = "0";

		setTimeout(() => {
			itemEl.remove();

			// Update remaining items - prefer id over filePath for filtering
			if (item.id) {
				this.config.items = this.config.items.filter((i) => i.id !== item.id);
			} else {
				this.config.items = this.config.items.filter((i) => i.filePath !== item.filePath);
			}

			// Update count or close if empty
			const countEl = this.contentEl.querySelector(".generic-event-list-count");
			if (countEl && this.config.items.length > 0) {
				const countText = this.config.countSuffix
					? `${this.config.items.length} event${this.config.items.length === 1 ? "" : "s"} ${this.config.countSuffix}`
					: `${this.config.items.length} event${this.config.items.length === 1 ? "" : "s"}`;
				countEl.textContent = countText;
			} else if (this.config.items.length === 0) {
				const message = this.config.successMessage || "All items processed!";
				new Notice(message);
				this.close();
			}
		}, 200);
	}
}

// Factory function for creating disabled recurring events modal
export function createDisabledRecurringEventsModal(
	app: App,
	bundle: CalendarBundle,
	disabledEvents: Array<{ filePath: string; title: string }>,
	closeCallback?: () => void
): GenericEventListModal {
	// Create modal instance first so we can reference it in the action handlers
	let modalInstance: GenericEventListModal;

	const config: EventListModalConfig = {
		title: "Disabled Recurring Events",
		emptyMessage: "No disabled recurring events.",
		items: disabledEvents.map((event) => ({
			filePath: event.filePath,
			title: event.title,
			subtitle: event.filePath,
		})),
		actions: [
			{
				label: "Enable",
				isPrimary: true,
				handler: async (item, itemEl) => {
					try {
						const command = new ToggleSkipCommand(app, bundle, item.filePath);
						await bundle.commandManager.executeCommand(command);

						// Access the modal instance via closure
						modalInstance.removeItem(itemEl, item);

						new Notice("Recurring event enabled");
					} catch (error) {
						console.error("Failed to enable recurring event:", error);
						new Notice("Failed to enable recurring event");
					}
				},
			},
			{
				label: "Open",
				handler: (item) => {
					app.workspace.openLinkText(item.filePath, "", false);
				},
			},
		],
		closeCallback,
		hotkeyCommandId: FULL_COMMAND_IDS.SHOW_DISABLED_RECURRING_EVENTS,
	};

	modalInstance = new GenericEventListModal(app, config);
	return modalInstance;
}

// Factory function for creating skipped events modal
export function createSkippedEventsModal(
	app: App,
	bundle: CalendarBundle,
	skippedEvents: ParsedEvent[],
	closeCallback?: () => void
): GenericEventListModal {
	let modalInstance: GenericEventListModal;

	// Helper to format time info for subtitle
	const formatTimeInfo = (event: ParsedEvent): string => {
		const startTime = DateTime.fromISO(event.start, { zone: "utc" });
		if (event.allDay) {
			return `All Day - ${startTime.toFormat("MMM d, yyyy")}`;
		}
		const endTime = event.end ? DateTime.fromISO(event.end, { zone: "utc" }) : null;
		if (endTime) {
			const durationText = formatDurationHumanReadable(startTime, endTime);
			return `${startTime.toFormat("MMM d, yyyy - h:mm a")} (${durationText})`;
		}
		return startTime.toFormat("MMM d, yyyy - h:mm a");
	};

	const config: EventListModalConfig = {
		title: "Skipped Events",
		emptyMessage: "No skipped events in the current view.",
		countSuffix: "currently skipped",
		items: skippedEvents.map((event) => ({
			id: event.id,
			filePath: event.ref.filePath,
			title: event.title,
			subtitle: formatTimeInfo(event),
		})),
		actions: [
			{
				label: "Un-skip",
				isPrimary: true,
				handler: async (item, itemEl) => {
					try {
						const command = new ToggleSkipCommand(app, bundle, item.filePath);
						await bundle.commandManager.executeCommand(command);

						modalInstance.removeItem(itemEl, item);

						new Notice("Event un-skipped");
					} catch (error) {
						console.error("Failed to un-skip event:", error);
						new Notice("Failed to un-skip event");
					}
				},
			},
			{
				label: "Open",
				handler: (item) => {
					app.workspace.openLinkText(item.filePath, "", false);
				},
			},
		],
		closeCallback,
		hotkeyCommandId: FULL_COMMAND_IDS.SHOW_SKIPPED_EVENTS,
		successMessage: "All events un-skipped!",
	};

	modalInstance = new GenericEventListModal(app, config);
	return modalInstance;
}
