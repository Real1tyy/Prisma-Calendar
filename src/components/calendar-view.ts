import { Calendar, type EventContentArg, type EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { MountableView } from "@real1ty-obsidian-plugins/common-plugin";
import { ColorEvaluator, formatDuration, isNotEmpty } from "@real1ty-obsidian-plugins/utils";
import { ItemView, type Modal, TFile, type WorkspaceLeaf } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { CreateEventCommand, type EventData, UpdateEventCommand } from "../core/commands";
import type { ParsedEvent } from "../core/parser";
import type { SingleCalendarConfig } from "../types/index";
import { removeZettelId } from "../utils/calendar-events";
import { cls } from "../utils/css-utils";
import { toggleEventHighlight } from "../utils/dom-utils";
import { roundToNearestHour, toLocalISOString } from "../utils/format";
import { emitHover } from "../utils/obsidian";
import type { PropertyRendererConfig } from "../utils/property-renderer";
import { createDefaultSeparator, renderPropertyValue } from "../utils/property-renderer";
import { BatchSelectionManager } from "./batch-selection-manager";
import { EventContextMenu } from "./event-context-menu";
import { EventCreateModal } from "./event-edit-modal";
import { EventPreviewModal } from "./event-preview-modal";
import { FilterPresetSelector } from "./filter-preset-selector";
import { ExpressionFilterInputManager } from "./input-managers/expression-filter";
import { SearchFilterInputManager } from "./input-managers/search-filter";
import {
	DisabledRecurringEventsModal,
	FilteredEventsModal,
	GlobalSearchModal,
	SelectedEventsModal,
	SkippedEventsModal,
} from "./list-modals";
import { AllTimeStatsModal, MonthlyStatsModal, WeeklyStatsModal } from "./weekly-stats";
import { ZoomManager } from "./zoom-manager";

const CALENDAR_VIEW_TYPE = "custom-calendar-view";

// FullCalendar-specific types
interface FullCalendarExtendedProps {
	filePath: string;
	folder: string;
	originalTitle: string;
	frontmatterDisplayData: Record<string, unknown>;
	isVirtual: boolean;
}

interface PrismaEventInput extends EventInput {
	extendedProps: FullCalendarExtendedProps;
}

export function getCalendarViewType(calendarId: string): string {
	return `${CALENDAR_VIEW_TYPE}-${calendarId}`;
}

export class CalendarView extends MountableView(ItemView, "prisma") {
	calendar: Calendar | null = null;
	private eventContextMenu: EventContextMenu;
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	private batchSelectionManager: BatchSelectionManager | null = null;
	private zoomManager: ZoomManager;
	private searchFilter: SearchFilterInputManager;
	private expressionFilter: ExpressionFilterInputManager;
	private filterPresetSelector: FilterPresetSelector;
	private container!: HTMLElement;
	private viewType: string;
	private skippedEventsModal: SkippedEventsModal | null = null;
	private disabledRecurringEventsModal: DisabledRecurringEventsModal | null = null;
	private filteredEventsModal: FilteredEventsModal | null = null;
	private selectedEventsModal: SelectedEventsModal | null = null;
	private globalSearchModal: GlobalSearchModal | null = null;
	private weeklyStatsModal: WeeklyStatsModal | null = null;
	private monthlyStatsModal: MonthlyStatsModal | null = null;
	private alltimeStatsModal: AllTimeStatsModal | null = null;
	private filteredEvents: ParsedEvent[] = [];
	private isIndexingComplete = false;
	private currentUpcomingEventIds: Set<string> = new Set();
	private upcomingEventCheckInterval: number | null = null;
	private filteredEventsCount = 0;
	private skippedEventsCount = 0;
	private disabledRecurringEventsCount = 0;
	private selectedEventsCount = 0;
	private isRefreshingEvents = false;

	constructor(
		leaf: WorkspaceLeaf,
		private bundle: CalendarBundle
	) {
		super(leaf);
		this.viewType = getCalendarViewType(bundle.calendarId);
		this.eventContextMenu = new EventContextMenu(this.app, bundle);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		this.zoomManager = new ZoomManager(bundle.settingsStore);
		this.searchFilter = new SearchFilterInputManager(() => this.refreshEvents());
		this.expressionFilter = new ExpressionFilterInputManager(() => this.refreshEvents());
		this.filterPresetSelector = new FilterPresetSelector(
			bundle.settingsStore.currentSettings.filterPresets,
			(expression: string) => {
				this.expressionFilter.setFilterValue(expression);
			}
		);
	}

	async undo(): Promise<boolean> {
		return await this.bundle.undo();
	}

	async redo(): Promise<boolean> {
		return await this.bundle.redo();
	}

	private buildBatchButtons(): Record<string, any> {
		const bsm = this.batchSelectionManager!;
		const clsBase = cls("batch-action-btn");

		return {
			batchCounter: {
				text: this.getSelectedEventsButtonText(),
				click: () => this.showSelectedEventsModal(),
				className: `${clsBase} ${cls("batch-counter")}`,
			},
			batchSelectAll: {
				text: "All",
				click: () => bsm.selectAllVisibleEvents(),
				className: `${clsBase} ${cls("select-all-btn")}`,
			},
			batchClear: {
				text: "Clear",
				click: () => bsm.clearSelection(),
				className: `${clsBase} ${cls("clear-btn")}`,
			},
			batchDuplicate: {
				text: "Duplicate",
				click: () => bsm.executeDuplicate(),
				className: `${clsBase} ${cls("duplicate-btn")}`,
			},
			batchMoveBy: {
				text: "Move By",
				click: () => bsm.executeMoveBy(),
				className: `${clsBase} ${cls("move-by-btn")}`,
			},
			batchCloneNext: {
				text: "Clone Next",
				click: () => bsm.executeClone(1),
				className: `${clsBase} ${cls("clone-next-btn")}`,
			},
			batchClonePrev: {
				text: "Clone Prev",
				click: () => bsm.executeClone(-1),
				className: `${clsBase} ${cls("clone-prev-btn")}`,
			},
			batchMoveNext: {
				text: "Move Next",
				click: () => bsm.executeMove(1),
				className: `${clsBase} ${cls("move-next-btn")}`,
			},
			batchMovePrev: {
				text: "Move Prev",
				click: () => bsm.executeMove(-1),
				className: `${clsBase} ${cls("move-prev-btn")}`,
			},
			batchOpenAll: {
				text: "Open",
				click: () => bsm.executeOpenAll(),
				className: `${clsBase} ${cls("open-all-btn")}`,
			},
			batchSkip: {
				text: "Skip",
				click: () => bsm.executeSkip(),
				className: `${clsBase} ${cls("skip-btn")}`,
			},
			batchDelete: {
				text: "Delete",
				click: () => bsm.executeDelete(),
				className: `${clsBase} ${cls("delete-btn")}`,
			},
			batchExit: {
				text: "Exit",
				click: () => this.toggleBatchSelection(),
				className: `${clsBase} ${cls("exit-btn")}`,
			},
		};
	}

	private buildRegularButtons(): Record<string, any> {
		return {
			createEvent: {
				text: "Create Event",
				click: () => this.createEventAtCurrentTime(),
			},
			zoomLevel: this.zoomManager.createZoomLevelButton(),
			batchSelect: {
				text: "Batch Select",
				click: () => this.toggleBatchSelection(),
			},
			filteredEvents: {
				text: this.getFilteredEventsButtonText(),
				click: () => this.showFilteredEventsModal(),
				className: this.filteredEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
			skippedEvents: {
				text: this.getSkippedEventsButtonText(),
				click: () => this.showSkippedEventsModal(),
				className: this.skippedEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
			disabledRecurringEvents: {
				text: this.getDisabledRecurringEventsButtonText(),
				click: () => this.showDisabledRecurringEventsModal(),
				className: this.disabledRecurringEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
		};
	}

	private buildToolbarConfig(inSelectionMode: boolean): {
		headerToolbar: { left: string; center: string; right: string };
		customButtons: Record<string, any>;
	} {
		const viewSwitchers = "dayGridMonth,timeGridWeek,timeGridDay,listWeek";

		if (inSelectionMode) {
			const left = "prev,next today";
			const right = [
				"batchCounter",
				"batchSelectAll",
				"batchClear",
				"batchDuplicate",
				"batchMoveBy",
				"batchCloneNext",
				"batchClonePrev",
				"batchMoveNext",
				"batchMovePrev",
				"batchOpenAll",
				"batchSkip",
				"batchDelete",
				"batchExit",
			].join(" ");

			return {
				headerToolbar: { left, center: "title", right },
				customButtons: this.buildBatchButtons(),
			};
		}

		const left = "prev,next today createEvent zoomLevel";
		const right = `filteredEvents disabledRecurringEvents skippedEvents batchSelect ${viewSwitchers}`;

		return {
			headerToolbar: { left, center: "title", right },
			customButtons: this.buildRegularButtons(),
		};
	}

	private updateToolbar(): void {
		if (!this.calendar || !this.batchSelectionManager) return;

		const inSelectionMode = this.batchSelectionManager.isInSelectionMode();

		if (inSelectionMode) {
			this.cleanupEventCountButtons();
		}

		const { headerToolbar, customButtons } = this.buildToolbarConfig(inSelectionMode);

		this.calendar.setOption("headerToolbar", headerToolbar);
		this.calendar.setOption("customButtons", customButtons);

		setTimeout(() => {
			if (!inSelectionMode) {
				this.applyFilteredEventsButtonState();
				this.applySkippedEventsButtonState();
				this.applyDisabledRecurringEventsButtonState();
				this.zoomManager.updateZoomLevelButton();
			}
		}, 0);
	}

	getViewType(): string {
		return this.viewType;
	}

	getDisplayText(): string {
		return this.bundle.settingsStore.currentSettings.name;
	}

	getIcon(): string {
		return "calendar";
	}

	private updateSkippedEventsButton(count: number): void {
		this.skippedEventsCount = count;
		this.applySkippedEventsButtonState();
	}

	private updateDisabledRecurringEventsButton(): void {
		if (!this.calendar) return; // Keep existing guard for recurring manager access

		const disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();
		const count = disabledEvents.length;

		this.disabledRecurringEventsCount = count;
		this.applyDisabledRecurringEventsButtonState();
	}

	private updateFilteredEventsButton(count: number): void {
		this.filteredEventsCount = count;
		this.applyFilteredEventsButtonState();
	}

	private applyFilteredEventsButtonState(): void {
		if (!this.calendar) return;
		const text = this.getFilteredEventsButtonText();
		const tooltip = `${this.filteredEventsCount} event${this.filteredEventsCount === 1 ? "" : "s"} filtered out by search or expression filters`;
		this.updateButtonElement(".fc-filteredEvents-button", text, this.filteredEventsCount > 0, tooltip);
	}

	private applySkippedEventsButtonState(): void {
		if (!this.calendar) return;
		const text = this.getSkippedEventsButtonText();
		const tooltip = `${this.skippedEventsCount} event${this.skippedEventsCount === 1 ? "" : "s"} hidden from calendar`;
		this.updateButtonElement(".fc-skippedEvents-button", text, this.skippedEventsCount > 0, tooltip);
	}

	private applyDisabledRecurringEventsButtonState(): void {
		if (!this.calendar) return;
		const text = this.getDisabledRecurringEventsButtonText();
		const tooltip = `${this.disabledRecurringEventsCount} recurring event${this.disabledRecurringEventsCount === 1 ? "" : "s"} disabled`;
		this.updateButtonElement(
			".fc-disabledRecurringEvents-button",
			text,
			this.disabledRecurringEventsCount > 0,
			tooltip
		);
	}

	private getFilteredEventsButtonText(): string {
		return `${this.filteredEventsCount} filtered`;
	}

	private getSkippedEventsButtonText(): string {
		return `${this.skippedEventsCount} skipped`;
	}

	private getDisabledRecurringEventsButtonText(): string {
		return `${this.disabledRecurringEventsCount} disabled`;
	}

	private getSelectedEventsButtonText(): string {
		return `${this.selectedEventsCount} selected`;
	}

	private updateButtonElement(selector: string, text: string, isVisible: boolean, tooltip?: string): void {
		if (!this.container) return;
		const btn = this.container.querySelector(selector);
		if (!(btn instanceof HTMLElement)) {
			return;
		}
		btn.textContent = text;
		if (tooltip !== undefined) {
			btn.title = tooltip;
		}

		if (isVisible) {
			btn.classList.remove(cls("fc-button-hidden"));
			btn.classList.add(cls("fc-button-visible"));
		} else {
			btn.classList.remove(cls("fc-button-visible"));
			btn.classList.add(cls("fc-button-hidden"));
		}
	}

	private cleanupEventCountButtons(): void {
		if (!this.container) return;

		const cleanupButton = (selector: string) => {
			const btn = this.container?.querySelector(selector);
			if (btn instanceof HTMLElement) {
				btn.textContent = "";
				btn.title = "";
				btn.classList.remove(cls("fc-button-visible"));
				btn.classList.add(cls("fc-button-hidden"));
			}
		};

		cleanupButton(".fc-filteredEvents-button");
		cleanupButton(".fc-skippedEvents-button");
		cleanupButton(".fc-disabledRecurringEvents-button");
	}

	private async toggleModal<T extends Modal>(
		getCurrentModal: () => T | null,
		setModal: (modal: T | null) => void,
		modalFactory: () => Promise<T> | T
	): Promise<void> {
		const currentModal = getCurrentModal();

		if (currentModal) {
			setModal(null);
			currentModal.close();
			return;
		}

		const modal = await modalFactory();
		setModal(modal);

		const originalOnClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			originalOnClose();
			setModal(null);
		};

		modal.open();
	}

	async showSkippedEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.skippedEventsModal,
			(modal) => {
				this.skippedEventsModal = modal;
			},
			async () => {
				if (!this.calendar) throw new Error("Calendar not initialized");

				const view = this.calendar.view;
				if (!view) throw new Error("Calendar view not available");

				const start = view.activeStart.toISOString();
				const end = view.activeEnd.toISOString();
				const skippedEvents = await this.bundle.eventStore.getSkippedEvents({ start, end });

				return new SkippedEventsModal(this.app, this.bundle, skippedEvents);
			}
		);
	}

	async showDisabledRecurringEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.disabledRecurringEventsModal,
			(modal) => {
				this.disabledRecurringEventsModal = modal;
				// Refresh the button count when modal closes
				if (!modal) {
					this.updateDisabledRecurringEventsButton();
				}
			},
			() => {
				const disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();
				return new DisabledRecurringEventsModal(this.app, this.bundle, disabledEvents);
			}
		);
	}

	async showFilteredEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.filteredEventsModal,
			(modal) => {
				this.filteredEventsModal = modal;
			},
			() => new FilteredEventsModal(this.app, this.filteredEvents)
		);
	}

	async showSelectedEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.selectedEventsModal,
			(modal) => {
				this.selectedEventsModal = modal;
			},
			() => {
				if (!this.batchSelectionManager) throw new Error("Batch selection manager not initialized");

				const selected = this.batchSelectionManager.getSelectedEvents();
				return new SelectedEventsModal(this.app, selected, (eventId: string) => {
					this.batchSelectionManager?.unselectEvent(eventId);
				});
			}
		);
	}

	async showGlobalSearchModal(): Promise<void> {
		await this.toggleModal(
			() => this.globalSearchModal,
			(modal) => {
				this.globalSearchModal = modal;
			},
			() => new GlobalSearchModal(this.app, this.bundle, this)
		);
	}

	async showWeeklyStatsModal(): Promise<void> {
		await this.toggleModal(
			() => this.weeklyStatsModal,
			(modal) => {
				this.weeklyStatsModal = modal;
			},
			() => {
				const currentDate = this.calendar?.getDate() || new Date();
				return new WeeklyStatsModal(this.app, this.bundle, currentDate);
			}
		);
	}

	async showMonthlyStatsModal(): Promise<void> {
		await this.toggleModal(
			() => this.monthlyStatsModal,
			(modal) => {
				this.monthlyStatsModal = modal;
			},
			() => {
				const currentDate = this.calendar?.getDate() || new Date();
				return new MonthlyStatsModal(this.app, this.bundle, currentDate);
			}
		);
	}

	async showAllTimeStatsModal(): Promise<void> {
		await this.toggleModal(
			() => this.alltimeStatsModal,
			(modal) => {
				this.alltimeStatsModal = modal;
			},
			() => {
				return new AllTimeStatsModal(this.app, this.bundle);
			}
		);
	}

	navigateToDate(date: Date, viewType?: string): void {
		if (!this.calendar) return;

		if (viewType) {
			this.calendar.changeView(viewType);
		}

		this.calendar.gotoDate(date);
	}

	highlightEventByPath(filePath: string, durationMs = 5000): void {
		if (!this.calendar) return;

		// Find all events with matching file path
		const events = this.calendar.getEvents();
		const matchingEvents = events.filter((event) => event.extendedProps?.filePath === filePath);

		for (const event of matchingEvents) {
			const eventElements = Array.from(document.querySelectorAll(`[data-event-id="${event.id}"]`));
			for (const element of eventElements) {
				if (element instanceof HTMLElement) {
					element.classList.add(cls("event-highlighted"));
					setTimeout(() => {
						element.classList.remove(cls("event-highlighted"));
					}, durationMs);
				}
			}
		}
	}

	private findUpcomingEventIds(): Set<string> {
		const result = new Set<string>();

		if (!this.calendar) return result;

		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.highlightUpcomingEvent) return result;

		const view = this.calendar.view;
		if (!view) return result;

		const now = new Date();
		const viewStart = view.activeStart;
		const viewEnd = view.activeEnd;

		// Only highlight if "now" is within the current view's date range
		if (now < viewStart || now > viewEnd) {
			return result;
		}

		// Get all events from the calendar
		const events = this.calendar.getEvents();

		// First, find all events that are currently active (now is between start and end)
		const activeEvents = events.filter((event) => {
			const eventStart = event.start;
			if (!eventStart) return false;
			// Exclude virtual events from being highlighted
			if (event.extendedProps?.isVirtual) return false;

			const eventEnd = event.end || eventStart;
			// Check if now is between start and end
			return eventStart <= now && now <= eventEnd;
		});

		// If there are active events, highlight all of them
		if (activeEvents.length > 0) {
			for (const event of activeEvents) {
				result.add(event.id);
			}
			return result;
		}

		// If no active events, find the next upcoming event (closest future start time)
		const upcomingEvents = events
			.filter((event) => {
				const eventStart = event.start;
				if (!eventStart) return false;
				// Exclude virtual events from being highlighted
				if (event.extendedProps?.isVirtual) return false;
				return eventStart > now;
			})
			.sort((a, b) => {
				const aStart = a.start?.getTime() || 0;
				const bStart = b.start?.getTime() || 0;
				return aStart - bStart;
			});

		// Return the ID of the first upcoming event
		if (upcomingEvents.length > 0) {
			result.add(upcomingEvents[0].id);
		}

		return result;
	}

	private updateUpcomingEventHighlight(): void {
		if (!this.calendar) return;

		const newUpcomingEventIds = this.findUpcomingEventIds();

		// Check if the set of highlighted events has changed
		const hasChanged =
			newUpcomingEventIds.size !== this.currentUpcomingEventIds.size ||
			Array.from(newUpcomingEventIds).some((id) => !this.currentUpcomingEventIds.has(id));

		if (!hasChanged) {
			return;
		}

		// Remove highlight from previous upcoming events that are no longer active
		for (const oldId of this.currentUpcomingEventIds) {
			if (!newUpcomingEventIds.has(oldId)) {
				toggleEventHighlight(oldId, cls("event-upcoming"), false);
			}
		}

		// Add highlight to new upcoming events
		for (const newId of newUpcomingEventIds) {
			if (!this.currentUpcomingEventIds.has(newId)) {
				toggleEventHighlight(newId, cls("event-upcoming"), true);
			}
		}

		// Update tracked IDs
		this.currentUpcomingEventIds = newUpcomingEventIds;
	}

	private startUpcomingEventCheck(): void {
		// Clear any existing interval
		this.stopUpcomingEventCheck();

		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.highlightUpcomingEvent) return;

		// Initial check
		this.updateUpcomingEventHighlight();

		// Set up interval to check once per minute (60000ms)
		this.upcomingEventCheckInterval = window.setInterval(() => {
			this.updateUpcomingEventHighlight();
		}, 60000);
	}

	private stopUpcomingEventCheck(): void {
		if (this.upcomingEventCheckInterval !== null) {
			window.clearInterval(this.upcomingEventCheckInterval);
			this.upcomingEventCheckInterval = null;
		}

		// Clear all highlighted upcoming events
		for (const eventId of this.currentUpcomingEventIds) {
			const eventElements = Array.from(document.querySelectorAll(`[data-event-id="${eventId}"]`));
			for (const element of eventElements) {
				if (element instanceof HTMLElement) {
					element.classList.remove(cls("event-upcoming"));
				}
			}
		}
		this.currentUpcomingEventIds.clear();
	}

	private async initializeCalendar(container: HTMLElement): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		this.calendar = new Calendar(container, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],

			timeZone: "local",

			initialView: settings.defaultView,

			nowIndicator: settings.nowIndicator,

			eventTimeFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},

			slotLabelFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},

			headerToolbar: false, // Initially false, will be set by updateToolbar

			eventContent: (arg) => {
				return this.renderEventContent(arg);
			},

			eventClassNames: (arg) => {
				const now = new Date();
				const eventEnd = arg.event.end || arg.event.start;
				if (!eventEnd) return [];

				const isPast = eventEnd < now;

				const classes = [];
				if (isPast) {
					const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
					if (contrast === 0) {
						classes.push(cls("past-event-hidden"));
					} else if (contrast < 100) {
						classes.push(cls("past-event-faded"));
					}
				}
				return classes;
			},

			customButtons: {}, // Initially empty, will be set by updateToolbar

			slotMinTime: `${String(settings.hourStart).padStart(2, "0")}:00:00`,
			slotMaxTime: `${String(settings.hourEnd).padStart(2, "0")}:00:00`,
			slotDuration: formatDuration(settings.slotDurationMinutes),
			snapDuration: formatDuration(settings.snapDurationMinutes),

			weekends: !settings.hideWeekends,
			firstDay: settings.firstDayOfWeek,

			// Event overlap settings
			eventOverlap: settings.eventOverlap,
			slotEventOverlap: settings.slotEventOverlap,
			eventMaxStack: settings.eventMaxStack,

			editable: true,
			eventStartEditable: true,
			eventDurationEditable: true,
			eventResizableFromStart: true,

			eventAllow: (_dropInfo, draggedEvent) => {
				return !draggedEvent?.extendedProps.isVirtual;
			},

			eventClick: (info) => {
				if (this.batchSelectionManager?.isInSelectionMode()) {
					if (!info.event.extendedProps.isVirtual) {
						this.batchSelectionManager.handleEventClick(info.event.id);
					}
				} else {
					this.handleEventClick(info);
				}
			},

			eventDidMount: (info) => {
				if (info.event.extendedProps.isVirtual) {
					info.el.classList.add(cls("virtual-event-opacity"), cls("virtual-event-cursor"));
					info.el.title = "Virtual recurring event (read-only)";
				} else {
					// Only register non-virtual events for batch selection
					this.batchSelectionManager?.handleEventMount(info.event.id, info.el);
				}
				this.handleEventMount(info);
			},

			eventMouseEnter: (info) => {
				// Always add context menu for all events (including virtual)
				info.el.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					this.eventContextMenu.show(e, info);
				});

				// Only add hover preview for non-virtual events
				if (!info.event.extendedProps.isVirtual) {
					const settings = this.bundle.settingsStore.currentSettings;
					const filePath = info.event.extendedProps.filePath as string | undefined;
					if (settings.enableEventPreview && filePath) {
						info.el.addEventListener("mouseenter", (e) => {
							emitHover(this.app, this.container, info.el, e, filePath, this.bundle.calendarId);
						});
					}
				}
			},

			eventDrop: (info) => {
				this.handleEventDrop(info);
			},

			eventResize: (info) => {
				this.handleEventResize(info);
			},

			dateClick: (info) => {
				this.handleDateClick(info);
			},

			datesSet: () => {
				this.refreshEvents();
				// Update zoom button visibility when view changes
				setTimeout(() => this.zoomManager.updateZoomLevelButton(), 100);
				// Save current state when view or date changes
				setTimeout(() => this.saveCurrentState(), 200);
				// Update upcoming event highlight when view changes
				setTimeout(() => this.updateUpcomingEventHighlight(), 300);
			},

			eventsSet: () => {
				this.batchSelectionManager?.refreshSelectionStyling();
				// Update upcoming event highlight when events change
				this.updateUpcomingEventHighlight();
			},

			height: "auto",
			aspectRatio: 1.35,
		});

		this.calendar.render();

		this.batchSelectionManager = new BatchSelectionManager(this.app, this.calendar, this.bundle);
		this.batchSelectionManager.setOnSelectionChangeCallback(() => {
			if (this.batchSelectionManager) {
				this.selectedEventsCount = this.batchSelectionManager.getSelectionCount();
			}
			this.updateToolbar();
		});
		this.updateToolbar();

		this.zoomManager.initialize(this.calendar, this.container);
		this.zoomManager.setOnZoomChangeCallback(() => this.saveCurrentState());

		// Initialize filters in reverse order since they all insert after zoom button
		// Order will be: Zoom → FilterPresetSelector → ExpressionFilter → SearchFilter
		this.searchFilter.initialize(this.calendar, this.container);
		this.expressionFilter.initialize(this.calendar, this.container);
		this.filterPresetSelector.initialize(this.calendar, this.container);

		if (this.bundle.viewStateManager.hasState()) {
			this.isRestoring = true;

			const savedZoomLevel = this.bundle.viewStateManager.getSavedZoomLevel();
			if (savedZoomLevel) {
				this.zoomManager.setCurrentZoomLevel(savedZoomLevel);
			}

			this.bundle.viewStateManager.restoreState(this.calendar);

			// Allow state saving again after restoration is complete
			setTimeout(() => {
				this.isRestoring = false;
			}, 500);
		}

		setTimeout(() => {
			if (this.calendar) {
				this.calendar.updateSize();
			}
		}, 100);

		// Ensure initial events are loaded after calendar is fully rendered
		await this.refreshEvents();

		// Start the upcoming event check interval
		this.startUpcomingEventCheck();
	}

	private updateCalendarSettings(settings: SingleCalendarConfig): void {
		if (!this.calendar) return;

		this.calendar.setOption("timeZone", "local");
		this.calendar.setOption("slotMinTime", `${String(settings.hourStart).padStart(2, "0")}:00:00`);
		this.calendar.setOption("slotMaxTime", `${String(settings.hourEnd).padStart(2, "0")}:00:00`);

		this.calendar.setOption("slotDuration", formatDuration(settings.slotDurationMinutes));
		this.calendar.setOption("snapDuration", formatDuration(settings.snapDurationMinutes));

		this.zoomManager.updateZoomLevelButton();

		this.calendar.setOption("weekends", !settings.hideWeekends);
		this.calendar.setOption("firstDay", settings.firstDayOfWeek);
		this.calendar.setOption("nowIndicator", settings.nowIndicator);

		// Update event overlap settings
		this.calendar.setOption("eventOverlap", settings.eventOverlap);
		this.calendar.setOption("slotEventOverlap", settings.slotEventOverlap);
		this.calendar.setOption("eventMaxStack", settings.eventMaxStack);

		this.filterPresetSelector.updatePresets(settings.filterPresets);

		// Restart or stop upcoming event check based on setting
		if (settings.highlightUpcomingEvent) {
			this.startUpcomingEventCheck();
		} else {
			this.stopUpcomingEventCheck();
		}

		this.refreshEvents();
	}

	refreshCalendar(): void {
		this.bundle.refreshCalendar();
	}

	private async refreshEvents(): Promise<void> {
		// Don't refresh events until indexing is complete
		if (!this.calendar || !this.isIndexingComplete || !this.calendar.view) {
			return;
		}

		if (this.isRefreshingEvents) {
			return;
		}

		this.isRefreshingEvents = true;
		const { view } = this.calendar;

		// Capture scroll position before touching events
		// The REAL scroller is the Obsidian view-content wrapper
		const viewContent = this.containerEl.querySelector(".view-content") as HTMLElement | null;

		// FullCalendar internal scroller (for some views like list)
		const innerScroller = this.container.querySelector(".fc-scroller") as HTMLElement | null;

		const viewContentScrollTop = viewContent?.scrollTop ?? 0;
		const innerScrollTop = innerScroller?.scrollTop ?? 0;

		try {
			const start = view.activeStart.toISOString();
			const end = view.activeEnd.toISOString();

			const allEvents = await this.bundle.eventStore.getNonSkippedEvents({ start, end });

			const filteredEvents: ParsedEvent[] = [];
			const visibleEvents: ParsedEvent[] = [];

			for (const event of allEvents) {
				const passesSearch = this.searchFilter.shouldInclude(event);
				const passesExpression = this.expressionFilter.shouldInclude(event);

				if (passesSearch && passesExpression) {
					visibleEvents.push(event);
				} else {
					filteredEvents.push(event);
				}
			}

			this.filteredEvents = filteredEvents;
			this.updateFilteredEventsButton(filteredEvents.length);

			const skippedEvents = await this.bundle.eventStore.getSkippedEvents({ start, end });
			this.updateSkippedEventsButton(skippedEvents.length);

			// Update disabled recurring events button
			this.updateDisabledRecurringEventsButton();

			// Convert to FullCalendar event format
			const calendarEvents: PrismaEventInput[] = visibleEvents.map((event) => {
				const classNames = ["regular-event"];
				if (event.isVirtual) {
					classNames.push(cls("virtual-event"));
				}
				const eventColor = this.getEventColor(event);

				// Strip Z suffix to treat times as naive local times (no timezone conversion)
				const start = event.start.replace(/Z$/, "");
				const end = event.end ? event.end.replace(/Z$/, "") : undefined;

				const folder = event.meta?.folder;
				const folderStr = typeof folder === "string" ? folder : "";

				return {
					id: event.id,
					title: event.title, // Keep original title for search/filtering
					start,
					end,
					allDay: event.allDay,
					extendedProps: {
						filePath: event.ref.filePath,
						folder: folderStr,
						originalTitle: event.title,
						frontmatterDisplayData: event.meta ?? {},
						isVirtual: event.isVirtual,
					},
					backgroundColor: eventColor,
					borderColor: eventColor,
					className: classNames.join(" "),
				};
			});

			// CRITICAL: Remove ALL events and event sources to prevent accumulation
			this.calendar.removeAllEvents();
			this.calendar.removeAllEventSources();

			// Add fresh event source with new events
			this.calendar.addEventSource({
				id: "main-events",
				events: calendarEvents,
			});
		} catch (error) {
			console.error("Error refreshing calendar events:", error);
		} finally {
			// Restore scroll after FC finishes layout
			requestAnimationFrame(() => {
				// Re-query in case DOM changed
				const viewContentRestored = this.containerEl.querySelector(".view-content") as HTMLElement | null;
				const inner = this.container.querySelector(".fc-scroller") as HTMLElement | null;

				if (viewContentRestored) {
					viewContentRestored.scrollTop = viewContentScrollTop;
				}

				if (inner) {
					inner.scrollTop = innerScrollTop;
				}

				// Release the lock after scroll restoration completes
				setTimeout(() => {
					this.isRefreshingEvents = false;
				}, 50);
			});
		}
	}

	private renderEventContent(arg: EventContentArg): any {
		const event = arg.event;

		const mainEl = document.createElement("div");
		mainEl.className = "fc-event-main";

		const container = document.createElement("div");
		container.className = cls("fc-event-content-wrapper");
		mainEl.appendChild(container);

		const headerEl = document.createElement("div");
		headerEl.className = cls("fc-event-header");

		if (!event.allDay && event.start) {
			const timeEl = document.createElement("div");
			timeEl.className = cls("fc-event-time");
			timeEl.textContent = arg.timeText;
			headerEl.appendChild(timeEl);
		}

		// Add title
		const titleEl = document.createElement("div");
		titleEl.className = cls("fc-event-title-custom");
		let title = event.title;
		if (title) {
			title = removeZettelId(title);
		}
		titleEl.textContent = title;
		headerEl.appendChild(titleEl);

		container.appendChild(headerEl);

		const displayProperties = this.getDisplayProperties(event);
		if (displayProperties.length > 0) {
			const propsContainer = document.createElement("div");
			propsContainer.className = cls("fc-event-props");

			for (const [prop, value] of displayProperties) {
				const propEl = document.createElement("div");
				propEl.className = cls("fc-event-prop");

				const keyEl = document.createElement("span");
				keyEl.className = cls("fc-event-prop-key");
				keyEl.textContent = `${prop}:`;
				propEl.appendChild(keyEl);

				const valueEl = document.createElement("span");
				valueEl.className = cls("fc-event-prop-value");
				this.renderPropertyValue(valueEl, value);
				propEl.appendChild(valueEl);

				propsContainer.appendChild(propEl);
			}
			container.appendChild(propsContainer);
		}

		return { domNodes: [mainEl] };
	}

	private getDisplayProperties(event: {
		extendedProps: { frontmatterDisplayData?: Record<string, unknown> };
	}): [string, unknown][] {
		const settings = this.bundle.settingsStore.currentSettings;
		const properties: [string, unknown][] = [];

		if (settings.frontmatterDisplayProperties.length > 0 && event.extendedProps.frontmatterDisplayData) {
			for (const prop of settings.frontmatterDisplayProperties) {
				const value = event.extendedProps.frontmatterDisplayData[prop];
				if (isNotEmpty(value)) {
					properties.push([prop, value]);
				}
			}
		}
		return properties;
	}

	private renderPropertyValue(container: HTMLElement, value: unknown): void {
		const config: PropertyRendererConfig = {
			createLink: (text: string, path: string) => {
				const link = document.createElement("a");
				link.className = cls("fc-event-prop-link");
				link.textContent = text;
				link.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation(); // Prevent event card click
					this.app.workspace.openLinkText(path, "", false);
				};
				return link;
			},
			createText: (text: string) => {
				// For calendar events, add space prefix for non-empty values
				const isFirstChild = container.childNodes.length === 0;
				const prefixedText = isFirstChild && text.trim() ? ` ${text}` : text;
				return document.createTextNode(prefixedText);
			},
			createSeparator: createDefaultSeparator,
		};

		renderPropertyValue(container, value, config);
	}

	private getEventColor(event: Pick<ParsedEvent, "meta">): string {
		const frontmatter = event.meta ?? {};
		return this.colorEvaluator.evaluateColor(frontmatter);
	}

	private async handleEventClick(info: any): Promise<void> {
		const event = info.event;
		const filePath = event.extendedProps.filePath;
		const isVirtual = event.extendedProps.isVirtual;

		// For virtual events, show preview of the source event
		if (isVirtual && filePath) {
			const sourceFile = this.app.vault.getAbstractFileByPath(filePath);
			if (sourceFile instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(sourceFile);
				if (cache?.frontmatter) {
					// Create a pseudo-event object with source file data for the preview
					const sourceEvent = {
						title: event.title,
						extendedProps: {
							filePath: filePath,
							frontmatterDisplayData: cache.frontmatter,
						},
					};
					new EventPreviewModal(this.app, this.bundle, sourceEvent).open();
					return;
				}
			}
		}

		// For regular and physical events, open the file
		if (filePath) {
			this.app.workspace.openLinkText(filePath, "", false);
		}
	}

	private handleEventMount(info: any): void {
		if (info.event.extendedProps.isVirtual) {
			info.el.classList.add(cls("virtual-event-italic"));
		}

		const element = info.el;
		const event = info.event;

		// Apply event color
		const eventColor = this.getEventColor({
			meta: event.extendedProps.frontmatterDisplayData,
		});

		element.style.setProperty("--event-color", eventColor);
		element.classList.add(cls("calendar-event"));

		// Set opacity CSS variable for past events
		const now = new Date();
		const eventEnd = event.end || event.start;
		const isPast = eventEnd < now;

		if (isPast) {
			const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
			const opacity = contrast / 100;
			element.style.setProperty("--past-event-opacity", opacity.toString());
		}

		// Add tooltip with file path and frontmatter display data
		const tooltipParts = [`File: ${event.extendedProps.filePath}`];

		const displayProperties = this.getDisplayProperties(event);
		for (const [prop, value] of displayProperties) {
			// Note: The value might be an array or object, so we need to stringify it for the tooltip.
			// Simple string interpolation `${value}` works for arrays but shows `[object Object]` for objects.
			// The existing behavior is maintained here.
			tooltipParts.push(`${prop}: ${value}`);
		}

		element.setAttribute("title", tooltipParts.join("\n"));
		element.addClass(cls("calendar-event"));
	}

	private handleDateClick(info: any): void {
		// Create a new event with pre-filled date/time
		const clickedDate = info.date;
		const isAllDay = info.allDay;

		// Create a mock event object for the modal
		const newEvent: any = {
			title: "",
			start: toLocalISOString(clickedDate),
			allDay: isAllDay,
			extendedProps: {
				filePath: null, // Will be created
			},
		};

		// Only add end time for timed events (not all-day events)
		if (!isAllDay) {
			const endDate = new Date(clickedDate);
			endDate.setHours(endDate.getHours() + 1);
			newEvent.end = toLocalISOString(endDate);
		}

		new EventCreateModal(this.app, this.bundle, newEvent, (eventData) => {
			this.createNewEvent(eventData, clickedDate);
		}).open();
	}

	private createEventAtCurrentTime(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const now = new Date();
		const roundedStart = roundToNearestHour(now);

		// Calculate end time using default duration from settings
		const endDate = new Date(roundedStart);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		// Create event object for the modal
		const newEvent: any = {
			title: "",
			start: toLocalISOString(roundedStart),
			end: toLocalISOString(endDate),
			allDay: false,
			extendedProps: {
				filePath: null,
			},
		};

		new EventCreateModal(this.app, this.bundle, newEvent, (eventData) => {
			this.createNewEvent(eventData, roundedStart);
		}).open();
	}

	private async createNewEvent(eventData: any, clickedDate: Date): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		try {
			const commandEventData: EventData = {
				filePath: null,
				title: eventData.title || `Event ${toLocalISOString(clickedDate).split("T")[0]}`,
				start: eventData.start,
				end: eventData.end,
				allDay: eventData.allDay,
				preservedFrontmatter: eventData.preservedFrontmatter,
			};

			const command = new CreateEventCommand(this.app, this.bundle, commandEventData, settings.directory, clickedDate);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error("Error creating new event:", error);
		}
	}

	private async handleEventUpdate(info: any, errorMessage: string): Promise<void> {
		if (info.event.extendedProps.isVirtual) {
			info.revert();
			return;
		}

		const filePath = info.event.extendedProps.filePath;
		if (!filePath) {
			console.error("No file path found for event");
			info.revert();
			return;
		}

		try {
			const command = new UpdateEventCommand(
				this.app,
				this.bundle,
				filePath,
				toLocalISOString(info.event.start),
				info.event.end ? toLocalISOString(info.event.end) : undefined,
				info.event.allDay || false,
				toLocalISOString(info.oldEvent.start),
				info.oldEvent.end ? toLocalISOString(info.oldEvent.end) : undefined,
				info.oldEvent.allDay || false
			);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error(errorMessage, error);
			info.revert();
		}
	}

	private async handleEventDrop(info: any): Promise<void> {
		await this.handleEventUpdate(info, "Error updating event dates:");
	}

	private async handleEventResize(info: any): Promise<void> {
		await this.handleEventUpdate(info, "Error updating event duration:");
	}

	private setupKeyboardShortcuts(): void {
		this.containerEl.setAttribute("tabindex", "-1");

		const keydownHandler = (e: KeyboardEvent) => {
			if (!this.calendar) return;

			// Only handle arrow keys without any modifiers
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.calendar.prev();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				this.calendar.next();
			}
		};

		this.containerEl.addEventListener("keydown", keydownHandler);

		this.containerEl.addEventListener("click", (e: MouseEvent) => {
			// Don't steal focus from input elements
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
				return;
			}
			this.containerEl.focus();
		});

		// Register cleanup
		this.register(() => {
			this.containerEl.removeEventListener("keydown", keydownHandler);
		});
	}

	async mount(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass(getCalendarViewType(this.bundle.calendarId));

		this.showLoading(root, "Indexing calendar events…");

		// Create calendar host
		this.container = root.createDiv(cls("calendar-container"));

		// Wait for layout before rendering FullCalendar
		await this.waitForLayout(this.container);
		await this.initializeCalendar(this.container);

		this.setupKeyboardShortcuts();

		setTimeout(() => this.containerEl.focus(), 100);

		// Resize updates
		this.observeResize(this.container, () => this.calendar?.updateSize());

		// Settings subscription
		const settingsSubscription = this.bundle.settingsStore.settings$.subscribe((settings: SingleCalendarConfig) => {
			this.updateCalendarSettings(settings);
		});
		this.register(() => settingsSubscription.unsubscribe());

		// Subscribe to indexing complete state
		const indexingCompleteSubscription = this.bundle.indexer.indexingComplete$.subscribe((isComplete) => {
			this.isIndexingComplete = isComplete;
			if (isComplete) {
				this.hideLoading();
				this.refreshEvents();
			} else {
				// Indexing started (e.g., filter expressions changed)
				const root = this.containerEl.children[1] as HTMLElement;
				this.showLoading(root, "Re-indexing calendar events…");
			}
		});
		this.register(() => indexingCompleteSubscription.unsubscribe());

		// Event store updates (only refreshes if indexing is complete)
		const eventStoreSubscription = this.bundle.eventStore.subscribe(() => this.refreshEvents());
		this.register(() => eventStoreSubscription.unsubscribe());

		const recurringEventManagerSubscription = this.bundle.recurringEventManager.subscribe(() => this.refreshEvents());
		this.register(() => recurringEventManagerSubscription.unsubscribe());
	}

	toggleBatchSelection(): void {
		const wasInSelectionMode = this.batchSelectionManager?.isInSelectionMode() ?? false;
		this.batchSelectionManager?.toggleSelectionMode();

		// Refresh events when exiting batch mode to restore skipped events button
		if (wasInSelectionMode) {
			this.refreshEvents();
		}
	}

	isInBatchSelectionMode(): boolean {
		return this.batchSelectionManager?.isInSelectionMode() ?? false;
	}

	selectAll(): void {
		this.batchSelectionManager?.selectAllVisibleEvents();
	}

	clearSelection(): void {
		this.batchSelectionManager?.clearSelection();
	}

	skipSelection(): void {
		this.batchSelectionManager?.executeSkip();
	}

	duplicateSelection(): void {
		this.batchSelectionManager?.executeDuplicate();
	}

	cloneSelection(weeks: number): void {
		this.batchSelectionManager?.executeClone(weeks);
	}

	moveSelection(weeks: number): void {
		this.batchSelectionManager?.executeMove(weeks);
	}

	deleteSelection(): void {
		this.batchSelectionManager?.executeDelete();
	}

	openSelection(): void {
		this.batchSelectionManager?.executeOpenAll();
	}

	moveBySelection(): void {
		this.batchSelectionManager?.executeMoveBy();
	}

	openFilterPresetSelector(): void {
		this.filterPresetSelector.open();
	}

	focusSearch(): void {
		this.searchFilter.focus();
	}

	focusExpressionFilter(): void {
		this.expressionFilter.focus();
	}

	private isRestoring = false;

	private saveCurrentState(): void {
		if (!this.calendar || this.isRestoring) return;

		const currentZoomLevel = this.zoomManager.getCurrentZoomLevel();
		this.bundle.viewStateManager.saveState(this.calendar, currentZoomLevel);
	}

	async unmount(): Promise<void> {
		this.saveCurrentState();

		// Stop upcoming event check interval
		this.stopUpcomingEventCheck();

		this.zoomManager.destroy();
		this.searchFilter.destroy();
		this.expressionFilter.destroy();

		this.calendar?.destroy();
		this.calendar = null;

		this.colorEvaluator.destroy();
		this.batchSelectionManager = null;
	}
}
