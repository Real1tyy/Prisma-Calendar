import { type App, Modal, Notice } from "obsidian";
import { FULL_COMMAND_IDS } from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";
import { ToggleSkipCommand } from "../core/commands";
import { removeZettelId } from "../utils/calendar-events";

export interface EventListItem {
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
	items: EventListItem[];
	actions: EventListAction[];
	closeCallback?: () => void;
	hotkeyCommandId?: string;
	onItemClick?: (item: EventListItem) => void;
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
		contentEl.createEl("p", {
			text: `${this.config.items.length} event${this.config.items.length === 1 ? "" : "s"}`,
			cls: "event-list-count",
		});

		// Event list
		const listEl = contentEl.createEl("div", { cls: "event-list" });

		for (const item of this.config.items) {
			this.createEventItem(listEl, item);
		}
	}

	private createEventItem(container: HTMLElement, item: EventListItem): void {
		const itemEl = container.createEl("div", { cls: "event-list-item" });

		// Event info
		const infoEl = itemEl.createEl("div", { cls: "event-info" });

		// Title (clickable)
		const titleEl = infoEl.createEl("div", { cls: "event-title" });
		const cleanTitle = removeZettelId(item.title);
		titleEl.textContent = cleanTitle;

		if (this.config.onItemClick) {
			titleEl.addClass("clickable");
			titleEl.onclick = () => {
				if (this.config.onItemClick) {
					this.config.onItemClick(item);
					this.close();
				}
			};
		}

		// Subtitle (optional)
		if (item.subtitle) {
			const subtitleEl = infoEl.createEl("div", { cls: "event-subtitle" });
			subtitleEl.textContent = item.subtitle;
		}

		// Action buttons
		if (this.config.actions.length > 0) {
			const actionsEl = itemEl.createEl("div", { cls: "event-actions" });

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

			// Update remaining items
			this.config.items = this.config.items.filter((i) => i.filePath !== item.filePath);

			// Update count or close if empty
			const countEl = this.contentEl.querySelector(".event-list-count");
			if (countEl && this.config.items.length > 0) {
				countEl.textContent = `${this.config.items.length} event${this.config.items.length === 1 ? "" : "s"}`;
			} else if (this.config.items.length === 0) {
				new Notice("All items processed!");
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
