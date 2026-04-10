import type { Calendar } from "@fullcalendar/core";
import { Draggable } from "@fullcalendar/interaction";
import { addCls, cls, ColorEvaluator, removeCls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { debounceTime } from "rxjs";

import { openCreateUntrackedEventModal } from "../core/api/modal-actions";
import type { CalendarBundle } from "../core/calendar-bundle";
import { MinimizedModalManager } from "../core/minimized-modal-manager";
import type { ParsedEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";
import { removeZettelId } from "../utils/event-naming";
import { normalizeFrontmatterForColorEvaluation } from "../utils/expression-utils";
import { getDisplayProperties, renderPropertyValue } from "../utils/property-display";

const BUTTON_INJECT_DELAY_MS = 100;
const SEARCH_FOCUS_DELAY_MS = 50;
const DROP_CLICK_IGNORE_MS = 500;
const DRAG_START_CLICK_IGNORE_MS = 1500;
const DRAG_HOVER_HIDE_DELAY_MS = 1000;
const DROP_END_CLICK_IGNORE_MS = 250;
const REFRESH_DEBOUNCE_MS = 300;

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

	// ─── Lifecycle ───────────────────────────────────────────────

	constructor(
		private app: App,
		private bundle: CalendarBundle
	) {
		this.colorEvaluator = new ColorEvaluator(this.bundle.settingsStore.settings$);
	}

	initialize(_calendar: Calendar, container: HTMLElement, placement: "left" | "right" = "right"): void {
		setTimeout(() => {
			this.injectButton(container, placement);
			this.refreshEvents();

			if (!this.storeSubscription) {
				this.storeSubscription = this.bundle.untrackedEventStore.changes$
					.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
					.subscribe(() => {
						this.ignoreOutsideClicksUntil = Date.now() + DROP_CLICK_IGNORE_MS;
						this.refreshEvents();
					});
			}
		}, BUTTON_INJECT_DELAY_MS);
	}

	destroy(): void {
		document.removeEventListener("click", this.handleOutsideClick);
		document.removeEventListener("keydown", this.handleKeyDown, true);
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

	// ─── UI Setup ────────────────────────────────────────────────

	private injectButton(container: HTMLElement, placement: "left" | "right"): void {
		const selector = placement === "left" ? ".fc-toolbar-chunk:first-child" : ".fc-toolbar-chunk:last-child";
		const toolbarRight = container.querySelector(selector);
		if (!toolbarRight) return;

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

		wrapper.appendChild(this.buttonEl);
		this.createDropdown(wrapper);

		if (placement === "left") {
			toolbarRight.appendChild(wrapper);
		} else {
			toolbarRight.prepend(wrapper);
		}

		document.addEventListener("click", this.handleOutsideClick);
		document.addEventListener("keydown", this.handleKeyDown, true);
	}

	private createDropdown(wrapper: HTMLElement): void {
		this.dropdownEl = document.createElement("div");
		this.dropdownEl.className = cls("untracked-dropdown");
		addCls(this.dropdownEl, "hidden");

		const createBtnEl = this.dropdownEl.createEl("button", {
			text: "+ Create untracked event",
			cls: cls("untracked-dropdown-create-btn"),
		});
		createBtnEl.addEventListener("click", (e) => {
			e.stopPropagation();
			this.close();
			openCreateUntrackedEventModal(this.bundle.plugin);
		});

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

		this.eventsListEl = this.dropdownEl.createDiv(cls("untracked-dropdown-list"));

		wrapper.appendChild(this.dropdownEl);

		// FullCalendar external dragging does not reliably trigger native drag events on the source list.
		// Use pointer-based tracking once to support "hover to hide" and prevent outside-click close after drop.
		this.setupDragTrackingOnce();
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
			this.ignoreOutsideClicksUntil = Date.now() + DRAG_START_CLICK_IGNORE_MS;
		});

		// Track pointer movement globally to detect hover over dropdown and hide after 1.5s.
		document.addEventListener("pointermove", this.handleGlobalPointerMove, true);
		document.addEventListener("pointerup", this.handleGlobalPointerUp, true);
		document.addEventListener("pointercancel", this.handleGlobalPointerUp, true);
	}

	// ─── Visibility ───────────────────────────────────────────────

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
		this.constrainDropdownWidth();

		setTimeout(() => this.searchInput?.focus(), SEARCH_FOCUS_DELAY_MS);
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

	restoreIfTemporarilyHidden(): void {
		this.restoreFromTemporaryHide();
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

	private constrainDropdownWidth(): void {
		if (!this.dropdownEl) return;
		const container = this.dropdownEl.closest(`.${cls("calendar-container")}`);
		if (!container) return;
		const available = container.getBoundingClientRect().right - this.dropdownEl.getBoundingClientRect().left;
		this.dropdownEl.style.setProperty("--dropdown-max-width", `${available}px`);
	}

	// ─── Event Filtering ──────────────────────────────────────────

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
				settings.colorRules.map((rule) => ({
					expression: rule.expression,
					enabled: rule.enabled,
				}))
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

			if (settings.showStopwatch) {
				const stopwatchBtn = eventRow.createEl("button", {
					cls: cls("untracked-dropdown-item-stopwatch"),
					attr: { title: "Start tracking", "aria-label": "Start tracking" },
				});
				stopwatchBtn.textContent = "▶";
				stopwatchBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
				stopwatchBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.startStopwatch(event);
				});
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

	// ─── Stopwatch ───────────────────────────────────────────────

	private startStopwatch(event: ParsedEvent): void {
		this.close();
		MinimizedModalManager.startStopwatchSession(this.app, this.bundle, {
			title: removeZettelId(event.title),
			start: new Date(),
			allDay: false,
			extendedProps: { filePath: event.ref.filePath },
		});
	}

	// ─── Event Handlers ───────────────────────────────────────────

	private handleOutsideClick = (e: MouseEvent): void => {
		if (!this.isOpen || !this.dropdownEl || !this.buttonEl) return;
		if (this.isDragging) return;
		if (Date.now() < this.ignoreOutsideClicksUntil) return;

		const target = e.target as Node;
		if (!this.dropdownEl.contains(target) && !this.buttonEl.contains(target)) {
			this.close();
		}
	};

	private handleKeyDown = (e: KeyboardEvent): void => {
		if (!this.isOpen) return;

		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();

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
		}, DRAG_HOVER_HIDE_DELAY_MS);
	};

	private handleGlobalPointerUp = (): void => {
		if (!this.isDragging) return;

		this.isDragging = false;
		this.ignoreOutsideClicksUntil = Date.now() + DROP_END_CLICK_IGNORE_MS;

		if (this.dragHoverTimeout) {
			window.clearTimeout(this.dragHoverTimeout);
			this.dragHoverTimeout = null;
		}

		this.restoreFromTemporaryHide();
	};

	// ─── Public API ───────────────────────────────────────────────

	ignoreOutsideClicksFor(ms: number): void {
		const until = Date.now() + Math.max(0, ms);
		this.ignoreOutsideClicksUntil = Math.max(this.ignoreOutsideClicksUntil, until);
	}
}
