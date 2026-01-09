import type { Calendar } from "@fullcalendar/core";
import { Draggable } from "@fullcalendar/interaction";
import { addCls, ColorEvaluator, cls, removeCls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { UpdateFrontmatterCommand } from "../core/commands/event-commands";
import type { ParsedEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";
import { removeZettelId } from "../utils/calendar-events";
import { normalizeFrontmatterForColorEvaluation } from "../utils/expression-utils";
import { getDisplayProperties, renderPropertyValue } from "../utils/property-display";

export class UntrackedEventsDropdown {
	private buttonEl: HTMLButtonElement | null = null;
	private dropdownEl: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private eventsListEl: HTMLElement | null = null;
	private isOpen = false;
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	private draggable: Draggable | null = null;
	private dragHoverTimeout: number | null = null;
	private isDragging = false;
	private isTemporarilyHidden = false;
	private ignoreOutsideClicksUntil = 0;
	private dragTrackingInitialized = false;
	private storeSubscription: { unsubscribe: () => void } | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle
	) {
		this.colorEvaluator = new ColorEvaluator(this.bundle.settingsStore.settings$);
	}

	initialize(_calendar: Calendar, container: HTMLElement): void {
		setTimeout(() => {
			this.injectButton(container);
			this.refreshEvents();

			// Keep the dropdown reactive without requiring CalendarView to manually refresh it.
			if (!this.storeSubscription) {
				this.storeSubscription = this.bundle.untrackedEventStore.subscribe(() => {
					// A drop often triggers a trailing click outside; don't let it close the dropdown.
					this.ignoreOutsideClicksUntil = Date.now() + 250;
					this.refreshEvents();
				});
			}
		}, 100);
	}

	updateVisibility(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!this.buttonEl) return;

		if (settings.showUntrackedEventsDropdown) {
			removeCls(this.buttonEl, "hidden");
		} else {
			addCls(this.buttonEl, "hidden");
			this.close();
		}
	}

	private injectButton(container: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.showUntrackedEventsDropdown) {
			return;
		}

		const toolbarLeft = container.querySelector(".fc-toolbar-chunk:first-child");
		if (!toolbarLeft) return;

		const wrapper = document.createElement("div");
		wrapper.className = cls("untracked-dropdown-wrapper");

		this.buttonEl = document.createElement("button");
		this.buttonEl.className = `${cls("untracked-dropdown-button")} fc-button fc-button-primary`;
		this.buttonEl.textContent = "Untracked";
		this.buttonEl.title = "Untracked events";

		this.buttonEl.addEventListener("click", (e) => {
			e.stopPropagation();
			this.toggle();
		});

		this.setupButtonDropZone(this.buttonEl);

		wrapper.appendChild(this.buttonEl);
		this.createDropdown(wrapper);

		toolbarLeft.appendChild(wrapper);

		// Close dropdown when clicking outside
		document.addEventListener("click", this.handleOutsideClick);
	}

	private createDropdown(wrapper: HTMLElement): void {
		this.dropdownEl = document.createElement("div");
		this.dropdownEl.className = cls("untracked-dropdown");
		addCls(this.dropdownEl, "hidden");

		// Search bar
		const searchContainer = this.dropdownEl.createDiv(cls("untracked-dropdown-search"));
		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search untracked events...",
			cls: cls("untracked-dropdown-search-input"),
		});

		this.searchInput.addEventListener("input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.filterEvents(query);
		});

		this.searchInput.addEventListener("click", (e) => {
			e.stopPropagation();
		});

		// Events list
		this.eventsListEl = this.dropdownEl.createDiv(cls("untracked-dropdown-list"));

		// Setup drop zone for calendar events
		this.setupDropZone();

		wrapper.appendChild(this.dropdownEl);

		// FullCalendar external dragging does not reliably trigger native drag events on the source list.
		// Use pointer-based tracking once to support "hover to hide" and prevent outside-click close after drop.
		this.setupDragTrackingOnce();
	}

	private setupButtonDropZone(button: HTMLButtonElement): void {
		button.addEventListener("dragover", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "move";
			}
			addCls(button, "drag-over");
		});

		button.addEventListener("dragleave", (e) => {
			e.preventDefault();
			removeCls(button, "drag-over");
		});

		button.addEventListener("drop", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			removeCls(button, "drag-over");

			const eventId = e.dataTransfer?.getData("text/plain");
			console.log("[UntrackedDropdown] Drop on button - eventId:", eventId);

			if (eventId) {
				const allEvents = this.bundle.eventStore.getAllEvents();
				const foundEvent = allEvents.find((ev) => ev.id === eventId);

				if (foundEvent) {
					console.log("[UntrackedDropdown] ✓ Clearing dates for:", foundEvent.title);
					await this.clearEventDatesWithCommand(foundEvent.ref.filePath);
				}
			}
		});
	}

	private setupDropZone(): void {
		if (!this.dropdownEl) return;

		this.dropdownEl.addEventListener("dragover", (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "move";
			}
			addCls(this.dropdownEl!, "drag-over");
		});

		this.dropdownEl.addEventListener("dragleave", (e) => {
			if (!this.dropdownEl?.contains(e.relatedTarget as Node)) {
				removeCls(this.dropdownEl!, "drag-over");
			}
		});

		this.dropdownEl.addEventListener("drop", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			removeCls(this.dropdownEl!, "drag-over");

			const eventId = e.dataTransfer?.getData("text/plain");
			console.log("[UntrackedDropdown] Drop on dropdown - eventId:", eventId);

			if (eventId) {
				const allEvents = this.bundle.eventStore.getAllEvents();
				const foundEvent = allEvents.find((ev) => ev.id === eventId);

				if (foundEvent) {
					console.log("[UntrackedDropdown] ✓ Clearing dates for:", foundEvent.title);
					await this.clearEventDatesWithCommand(foundEvent.ref.filePath);
				}
			}
		});
	}

	private async clearEventDatesWithCommand(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) {
			console.error("[UntrackedDropdown] File not found:", filePath);
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;

		// Use command for undo/redo support
		const propertyUpdates = new Map<string, string | null>();
		propertyUpdates.set(settings.startProp, null);
		propertyUpdates.set(settings.endProp, null);
		propertyUpdates.set(settings.dateProp, null);
		propertyUpdates.set(settings.allDayProp, null);

		const command = new UpdateFrontmatterCommand(this.app, this.bundle, filePath, propertyUpdates);

		try {
			await this.bundle.commandManager.executeCommand(command);
			console.log("[UntrackedDropdown] ✓ Cleared dates");
		} catch (error) {
			console.error("[UntrackedDropdown] Error clearing dates:", error);
		}
	}

	private handleOutsideClick = (e: MouseEvent): void => {
		if (!this.isOpen || !this.dropdownEl || !this.buttonEl) return;
		if (this.isDragging) return;
		if (Date.now() < this.ignoreOutsideClicksUntil) return;

		const target = e.target as Node;
		if (!this.dropdownEl.contains(target) && !this.buttonEl.contains(target)) {
			this.close();
		}
	};

	toggle(): void {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	open(): void {
		if (!this.dropdownEl || !this.buttonEl) return;

		this.isOpen = true;
		this.isTemporarilyHidden = false;
		removeCls(this.dropdownEl, "hidden");
		addCls(this.buttonEl, "active");

		setTimeout(() => this.searchInput?.focus(), 50);
	}

	close(): void {
		if (!this.dropdownEl || !this.buttonEl) return;

		this.isOpen = false;
		this.isTemporarilyHidden = false;
		addCls(this.dropdownEl, "hidden");
		removeCls(this.buttonEl, "active");

		if (this.searchInput) {
			this.searchInput.value = "";
		}
		this.filterEvents("");
	}

	private temporarilyHide(): void {
		if (!this.dropdownEl || !this.isOpen) return;

		this.isTemporarilyHidden = true;
		addCls(this.dropdownEl, "hidden");
	}

	private restoreFromTemporaryHide(): void {
		if (!this.dropdownEl || !this.isOpen || !this.isTemporarilyHidden) return;

		this.isTemporarilyHidden = false;
		removeCls(this.dropdownEl, "hidden");
	}

	refreshEvents(): void {
		this.filterEvents(this.searchInput?.value || "");
	}

	private filterEvents(query: string): void {
		if (!this.eventsListEl) return;

		const untrackedEvents = this.bundle.untrackedEventStore.getUntrackedEvents();

		const lowerQuery = query.toLowerCase();
		const filteredEvents = untrackedEvents.filter((event) => {
			const title = removeZettelId(event.title).toLowerCase();
			return title.includes(lowerQuery);
		});

		this.renderEvents(filteredEvents, untrackedEvents.length);
	}

	private renderEvents(filteredEvents: ParsedEvent[], totalCount: number): void {
		if (!this.eventsListEl) return;

		this.eventsListEl.empty();

		// Destroy old draggable instance if exists
		if (this.draggable) {
			this.draggable.destroy();
			this.draggable = null;
		}

		if (filteredEvents.length === 0) {
			const emptyMsg = this.eventsListEl.createDiv(cls("untracked-dropdown-empty"));
			emptyMsg.textContent = totalCount === 0 ? "No untracked events" : "No events match your search";
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;

		for (const event of filteredEvents) {
			const eventRow = this.eventsListEl.createDiv(cls("untracked-dropdown-item"));
			eventRow.classList.add("fc-event"); // FullCalendar draggable class
			eventRow.setAttribute("data-file-path", event.ref.filePath);

			// Apply color
			const normalizedFrontmatter = normalizeFrontmatterForColorEvaluation(
				event.meta || {},
				settings.colorRules.map((rule) => ({ expression: rule.expression, enabled: rule.enabled }))
			);
			const color = this.colorEvaluator.evaluateColor(normalizedFrontmatter);

			if (color) {
				eventRow.style.setProperty("--event-color", color);
			}

			// Event title
			const titleEl = eventRow.createDiv(cls("untracked-dropdown-item-title"));
			titleEl.textContent = removeZettelId(event.title);

			// Display properties
			if (event.meta) {
				const settings = this.bundle.settingsStore.currentSettings;
				const displayProps = getDisplayProperties(event.meta, settings.frontmatterDisplayPropertiesUntracked);

				if (displayProps.length > 0) {
					const propsEl = eventRow.createDiv(cls("untracked-dropdown-item-props"));
					for (const [key, value] of displayProps) {
						const propEl = propsEl.createSpan(cls("untracked-dropdown-item-prop"));
						propEl.createSpan({ text: `${key}: `, cls: cls("prop-key") });
						const valueSpan = propEl.createSpan({ cls: cls("prop-value") });
						renderPropertyValue(valueSpan, value, {
							app: this.app,
							linkClassName: cls("prop-link"),
							onLinkClick: () => this.close(),
						});
					}
				}
			}

			// Double-click to open file (single click starts drag)
			eventRow.addEventListener("dblclick", (e) => {
				e.stopPropagation();
				void this.app.workspace.openLinkText(event.ref.filePath, "", false);
			});
		}

		// Initialize FullCalendar Draggable for all events in the list
		this.draggable = new Draggable(this.eventsListEl, {
			itemSelector: `.${cls("untracked-dropdown-item")}`,
			eventData: (eventEl) => {
				const filePath = eventEl.getAttribute("data-file-path");
				const titleEl = eventEl.querySelector(`.${cls("untracked-dropdown-item-title")}`);
				const title = titleEl?.textContent || "Untitled";

				return {
					title,
					extendedProps: {
						filePath,
						isUntrackedDrop: true,
					},
				};
			},
		});
	}

	private setupDragTrackingOnce(): void {
		if (this.dragTrackingInitialized) return;
		if (!this.eventsListEl || !this.dropdownEl) return;

		this.dragTrackingInitialized = true;

		// Start "dragging" on pointerdown of an item (matches FullCalendar external drag UX).
		this.eventsListEl.addEventListener("pointerdown", (e) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;
			const item = target.closest(`.${cls("untracked-dropdown-item")}`);
			if (!item) return;

			this.isDragging = true;
			this.isTemporarilyHidden = false;

			// Prevent the common "click after drop" from closing the dropdown.
			this.ignoreOutsideClicksUntil = Date.now() + 1500;
		});

		// Track pointer movement globally to detect hover over dropdown and hide after 1.5s.
		document.addEventListener("pointermove", this.handleGlobalPointerMove, true);
		document.addEventListener("pointerup", this.handleGlobalPointerUp, true);
		document.addEventListener("pointercancel", this.handleGlobalPointerUp, true);
	}

	private handleGlobalPointerMove = (e: PointerEvent): void => {
		if (!this.isDragging || !this.isOpen || !this.dropdownEl) return;
		if (this.isTemporarilyHidden) return;

		const rect = this.dropdownEl.getBoundingClientRect();
		const isOverDropdown =
			e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

		if (!isOverDropdown) {
			if (this.dragHoverTimeout) {
				window.clearTimeout(this.dragHoverTimeout);
				this.dragHoverTimeout = null;
			}
			return;
		}

		if (this.dragHoverTimeout) return;

		this.dragHoverTimeout = window.setTimeout(() => {
			this.temporarilyHide();
			this.dragHoverTimeout = null;
		}, 1500);
	};

	private handleGlobalPointerUp = (): void => {
		if (!this.isDragging) return;

		this.isDragging = false;
		this.ignoreOutsideClicksUntil = Date.now() + 250;

		if (this.dragHoverTimeout) {
			window.clearTimeout(this.dragHoverTimeout);
			this.dragHoverTimeout = null;
		}

		this.restoreFromTemporaryHide();
	};

	destroy(): void {
		document.removeEventListener("click", this.handleOutsideClick);
		document.removeEventListener("pointermove", this.handleGlobalPointerMove, true);
		document.removeEventListener("pointerup", this.handleGlobalPointerUp, true);
		document.removeEventListener("pointercancel", this.handleGlobalPointerUp, true);
		this.storeSubscription?.unsubscribe();
		this.storeSubscription = null;
		this.colorEvaluator.destroy();

		// Clear any pending timeouts
		if (this.dragHoverTimeout) {
			window.clearTimeout(this.dragHoverTimeout);
			this.dragHoverTimeout = null;
		}

		// Destroy FullCalendar Draggable instance
		if (this.draggable) {
			this.draggable.destroy();
			this.draggable = null;
		}

		this.buttonEl?.remove();
		this.dropdownEl?.remove();
		this.buttonEl = null;
		this.dropdownEl = null;
		this.searchInput = null;
		this.eventsListEl = null;
	}
}
