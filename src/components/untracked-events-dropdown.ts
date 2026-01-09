import type { Calendar } from "@fullcalendar/core";
import { Draggable } from "@fullcalendar/interaction";
import { addCls, ColorEvaluator, cls, removeCls, toggleCls } from "@real1ty-obsidian-plugins/utils";
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
	private untrackedEvents: ParsedEvent[] = [];
	private filteredEvents: ParsedEvent[] = [];
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	private draggable: Draggable | null = null;

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
		}, 100);
	}

	updateVisibility(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!this.buttonEl) return;

		if (settings.showUntrackedEventsDropdown) {
			this.buttonEl.style.display = "";
		} else {
			this.buttonEl.style.display = "none";
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
		this.buttonEl.textContent = "⋮";
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

		// Close dropdown on ESC key
		document.addEventListener("keydown", this.handleKeyDown);
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

		this.searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				e.preventDefault();
				this.close();
			}
		});

		// Events list
		this.eventsListEl = this.dropdownEl.createDiv(cls("untracked-dropdown-list"));

		// Setup drop zone for calendar events
		this.setupDropZone();

		wrapper.appendChild(this.dropdownEl);
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

		const target = e.target as Node;
		if (!this.dropdownEl.contains(target) && !this.buttonEl.contains(target)) {
			this.close();
		}
	};

	private handleKeyDown = (e: KeyboardEvent): void => {
		if (!this.isOpen) return;

		if (e.key === "Escape") {
			// Don't close if search input is focused and has content - clear it first
			if (this.searchInput && document.activeElement === this.searchInput) {
				if (this.searchInput.value) {
					this.searchInput.value = "";
					this.filterEvents("");
					return;
				}
			}
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
		removeCls(this.dropdownEl, "hidden");
		addCls(this.buttonEl, "active");

		setTimeout(() => this.searchInput?.focus(), 50);
	}

	close(): void {
		if (!this.dropdownEl || !this.buttonEl) return;

		this.isOpen = false;
		addCls(this.dropdownEl, "hidden");
		removeCls(this.buttonEl, "active");

		if (this.searchInput) {
			this.searchInput.value = "";
		}
		this.filterEvents("");
	}

	refreshEvents(): void {
		this.untrackedEvents = this.bundle.untrackedEventStore.getUntrackedEvents();
		this.filterEvents(this.searchInput?.value || "");
		this.updateButtonState();
	}

	private updateButtonState(): void {
		if (!this.buttonEl) return;

		const count = this.untrackedEvents.length;
		this.buttonEl.title = `${count} untracked event${count === 1 ? "" : "s"}`;

		// Update button appearance based on whether there are events
		toggleCls(this.buttonEl, "has-events", count > 0);
	}

	private filterEvents(query: string): void {
		if (!this.eventsListEl) return;

		const lowerQuery = query.toLowerCase();
		this.filteredEvents = this.untrackedEvents.filter((event) => {
			const title = removeZettelId(event.title).toLowerCase();
			return title.includes(lowerQuery);
		});

		this.renderEvents();
	}

	private renderEvents(): void {
		if (!this.eventsListEl) return;

		this.eventsListEl.empty();

		// Destroy old draggable instance if exists
		if (this.draggable) {
			this.draggable.destroy();
			this.draggable = null;
		}

		if (this.filteredEvents.length === 0) {
			const emptyMsg = this.eventsListEl.createDiv(cls("untracked-dropdown-empty"));
			emptyMsg.textContent = this.untrackedEvents.length === 0 ? "No untracked events" : "No events match your search";
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;

		for (const event of this.filteredEvents) {
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

			// Click to open file
			eventRow.addEventListener("click", () => {
				void this.app.workspace.openLinkText(event.ref.filePath, "", false);
				this.close();
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

	destroy(): void {
		document.removeEventListener("click", this.handleOutsideClick);
		document.removeEventListener("keydown", this.handleKeyDown);
		this.colorEvaluator.destroy();

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
