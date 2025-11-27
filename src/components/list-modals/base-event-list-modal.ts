import { addCls, cls } from "@real1ty-obsidian-plugins/utils";
import { Modal, type Modifier, Notice } from "obsidian";
import { removeZettelId } from "../../utils/calendar-events";

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

export abstract class BaseEventListModal extends Modal {
	protected searchInput: HTMLInputElement | null = null;
	protected listContainer: HTMLElement | null = null;
	protected filteredItems: EventListItem[] = [];
	protected items: EventListItem[] = [];

	// Abstract methods that subclasses must implement
	protected abstract getTitle(): string;
	protected abstract getEmptyMessage(): string;
	protected abstract getCountSuffix(): string | undefined;
	protected abstract getItems(): EventListItem[];
	protected abstract getActions(): EventListAction[];
	protected abstract getHotkeyCommandId(): string | undefined;
	protected abstract getSuccessMessage(): string | undefined;
	protected abstract onModalClose(): void;

	// Optional hook for subclasses to render custom UI after title
	protected renderCustomHeaderElements(_contentEl: HTMLElement): void {
		// Default: no custom elements
	}

	// Optional hook for subclasses to perform async initialization
	protected onBeforeRender(): void {
		// Default: no async initialization
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		addCls(contentEl, "generic-event-list-modal");

		// Allow subclasses to perform async initialization
		this.onBeforeRender();
		// Initialize items after subclass properties are set
		this.items = this.getItems();
		this.filteredItems = [...this.items];

		this.registerHotkeys();

		// Title
		contentEl.createEl("h2", { text: this.getTitle() });

		// Allow subclasses to inject custom header elements (e.g., filter toggles)
		this.renderCustomHeaderElements(contentEl);

		if (this.items.length === 0) {
			contentEl.createEl("p", { text: this.getEmptyMessage() });
			return;
		}

		// Search input
		const searchContainer = contentEl.createEl("div", { cls: cls("generic-event-list-search") });
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search events... (Ctrl/Cmd+F)",
			cls: cls("generic-event-search-input"),
		});

		this.searchInput.addEventListener("input", (e) => {
			const target = e.target as HTMLInputElement;
			this.filterItems(target.value);
		});

		// Auto-focus the search input when modal opens
		setTimeout(() => {
			this.searchInput?.focus();
		}, 50);

		// Count
		const countSuffix = this.getCountSuffix();
		const countText = countSuffix
			? `${this.items.length} event${this.items.length === 1 ? "" : "s"} ${countSuffix}`
			: `${this.items.length} event${this.items.length === 1 ? "" : "s"}`;
		contentEl.createEl("p", {
			text: countText,
			cls: cls("generic-event-list-count"),
		});

		// Event list
		this.listContainer = contentEl.createEl("div", { cls: cls("generic-event-list") });

		this.renderItems();
	}

	protected registerHotkeys(): void {
		// Register Ctrl/Cmd+F to focus search
		this.scope.register(["Mod"], "f", (evt) => {
			evt.preventDefault();
			this.searchInput?.focus();
			this.searchInput?.select();
			return false;
		});

		// Register Escape to close modal or clear search
		this.scope.register([], "Escape", () => {
			// If search is focused and has content, clear it first
			if (this.searchInput && document.activeElement === this.searchInput) {
				if (this.searchInput.value) {
					this.searchInput.value = "";
					this.filterItems("");
					return false;
				}
				// If search is empty, unfocus it
				this.searchInput.blur();
				return false;
			}
			// Otherwise close the modal
			this.close();
			return false;
		});

		// Listen for command hotkey to toggle close
		const hotkeyCommandId = this.getHotkeyCommandId();
		if (hotkeyCommandId) {
			const appWithHotkeys = this.app as unknown as {
				hotkeyManager?: {
					getHotkeys: (id: string) => Array<{ modifiers: Modifier[]; key: string }>;
				};
			};
			const hotkeys = appWithHotkeys.hotkeyManager?.getHotkeys(hotkeyCommandId);
			if (hotkeys && hotkeys.length > 0) {
				for (const hotkey of hotkeys) {
					this.scope.register(hotkey.modifiers, hotkey.key, () => {
						this.close();
						return false;
					});
				}
			}
		}
	}

	protected filterItems(searchText: string): void {
		const normalizedSearch = searchText.toLowerCase().trim();

		if (!normalizedSearch) {
			this.filteredItems = [...this.items];
		} else {
			this.filteredItems = this.items.filter((item) => {
				const cleanTitle = removeZettelId(item.title).toLowerCase();
				return cleanTitle.includes(normalizedSearch);
			});
		}

		this.updateEventCount();
		this.renderItems();
	}

	protected updateEventCount(): void {
		const countEl = this.contentEl.querySelector(`.${cls("generic-event-list-count")}`);
		if (!countEl) return;

		const countSuffix = this.getCountSuffix();
		const isFiltered = this.filteredItems.length !== this.items.length;

		let countText: string;
		if (isFiltered) {
			// Show "X of Y events" when filtered
			countText = countSuffix
				? `${this.filteredItems.length} of ${this.items.length} event${this.items.length === 1 ? "" : "s"} ${countSuffix}`
				: `${this.filteredItems.length} of ${this.items.length} event${this.items.length === 1 ? "" : "s"}`;
		} else {
			// Show "Y events" when not filtered
			countText = countSuffix
				? `${this.items.length} event${this.items.length === 1 ? "" : "s"} ${countSuffix}`
				: `${this.items.length} event${this.items.length === 1 ? "" : "s"}`;
		}

		countEl.textContent = countText;
	}

	protected renderItems(): void {
		if (!this.listContainer) return;

		this.listContainer.empty();

		if (this.filteredItems.length === 0) {
			this.listContainer.createEl("p", {
				text: "No events match your search.",
				cls: cls("generic-event-list-empty"),
			});
			return;
		}

		for (const item of this.filteredItems) {
			this.createEventItem(this.listContainer, item);
		}
	}

	protected createEventItem(container: HTMLElement, item: EventListItem): void {
		const itemEl = container.createEl("div", { cls: cls("generic-event-list-item") });

		// Event info
		const infoEl = itemEl.createEl("div", { cls: cls("generic-event-info") });

		// Title
		const titleEl = infoEl.createEl("div", { cls: cls("generic-event-title") });
		const cleanTitle = removeZettelId(item.title);
		titleEl.textContent = cleanTitle;

		// Subtitle (time/path info)
		if (item.subtitle) {
			const subtitleEl = infoEl.createEl("div", { cls: cls("generic-event-subtitle") });
			subtitleEl.textContent = item.subtitle;
		}

		// Action buttons
		const actions = this.getActions();
		if (actions.length > 0) {
			const actionsEl = itemEl.createEl("div", { cls: cls("generic-event-actions") });

			for (const action of actions) {
				const btn = actionsEl.createEl("button", { text: action.label });
				if (action.isPrimary) {
					btn.addClass("mod-cta");
				}
				btn.addEventListener("click", (e) => {
					e.stopPropagation(); // Prevent triggering item click
					void action.handler(item, itemEl);
				});
			}
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.onModalClose();
	}

	// Helper method for removing items with animation
	protected removeItem(itemEl: HTMLElement, item: EventListItem): void {
		itemEl.classList.add("prisma-fade-out");

		setTimeout(() => {
			itemEl.remove();

			// Update remaining items - prefer id over filePath for filtering
			if (item.id) {
				this.items = this.items.filter((i) => i.id !== item.id);
				this.filteredItems = this.filteredItems.filter((i) => i.id !== item.id);
			} else {
				this.items = this.items.filter((i) => i.filePath !== item.filePath);
				this.filteredItems = this.filteredItems.filter((i) => i.filePath !== item.filePath);
			}

			// Update count or close if empty
			if (this.items.length > 0) {
				this.updateEventCount();
			} else {
				const message = this.getSuccessMessage() || "All items processed!";
				new Notice(message);
				this.close();
			}
		}, 200);
	}
}
