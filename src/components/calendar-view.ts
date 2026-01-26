import { Calendar, type CustomButtonInput, type EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DropArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ColorEvaluator, cls, formatDuration, MountableView, toggleCls } from "@real1ty-obsidian-plugins";
import { ItemView, type Modal, TFile, type WorkspaceLeaf } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { FillTimeCommand, UpdateEventCommand, UpdateFrontmatterCommand } from "../core/commands";
import type {
	AllDayEvent,
	CalendarEvent,
	CalendarEventData,
	EventMountInfo,
	EventUpdateInfo,
	ExtendedButtonInput,
	PrismaEventInput,
	TimedEvent,
} from "../types/calendar";
import { isTimedEvent, isUntrackedEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/index";
import {
	cleanupTitle,
	findAdjacentEvent,
	getCommonCategories,
	getSourceEventInfoFromVirtual,
	stripISOSuffix,
} from "../utils/calendar-events";
import { isPointInsideElement, toggleEventHighlight } from "../utils/dom-utils";
import { normalizeFrontmatterForColorEvaluation } from "../utils/expression-utils";
import { calculateDuration, calculateEndTime, roundToNearestHour, toLocalISOString } from "../utils/format";
import { emitHover } from "../utils/obsidian";
import { extractPropertyText, getDisplayProperties, renderPropertyValue } from "../utils/property-display";
import { BatchSelectionManager } from "./batch-selection-manager";
import { EventContextMenu } from "./event-context-menu";
import { EventPreviewModal, type PreviewEventData } from "./event-preview-modal";
import { FilterPresetSelector } from "./filter-preset-selector";
import { ExpressionFilterInputManager } from "./input-managers/expression-filter";
import { SearchFilterInputManager } from "./input-managers/search-filter";
import {
	FilteredEventsModal,
	GlobalSearchModal,
	RecurringEventsModal,
	SelectedEventsModal,
	SkippedEventsModal,
} from "./list-modals";
import { EventCreateModal } from "./modals";
import { BatchFrontmatterModal } from "./modals/batch-frontmatter-modal";
import { CategoryAssignModal } from "./modals/category-assign-modal";
import { CategorySelectModal } from "./modals/category-select-modal";
import { IntervalEventsModal } from "./modals/interval-events-modal";
import { UntrackedEventsDropdown } from "./untracked-events-dropdown";
import { AllTimeStatsModal, DailyStatsModal, MonthlyStatsModal, WeeklyStatsModal } from "./weekly-stats";
import { ZoomManager } from "./zoom-manager";

const CALENDAR_VIEW_TYPE = "custom-calendar-view";

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
	private recurringEventsModal: RecurringEventsModal | null = null;
	private filteredEventsModal: FilteredEventsModal | null = null;
	private untrackedEventsDropdown: UntrackedEventsDropdown | null = null;
	private selectedEventsModal: SelectedEventsModal | null = null;
	private globalSearchModal: GlobalSearchModal | null = null;
	private dailyStatsModal: DailyStatsModal | null = null;
	private weeklyStatsModal: WeeklyStatsModal | null = null;
	private monthlyStatsModal: MonthlyStatsModal | null = null;
	private alltimeStatsModal: AllTimeStatsModal | null = null;
	private intervalEventsModal: IntervalEventsModal | null = null;
	private filteredEvents: CalendarEvent[] = [];
	private isIndexingComplete = false;
	private currentUpcomingEventIds: Set<string> = new Set();
	private upcomingEventCheckInterval: number | null = null;
	private categoryHighlightTimeout: number | null = null;
	private highlightedCategoryEvents: Set<string> = new Set();
	private currentCategoryHighlightClass: string | null = null;
	private filteredEventsCount = 0;
	private skippedEventsCount = 0;
	private enabledRecurringEventsCount = 0;
	private selectedEventsCount = 0;
	private isRefreshingEvents = false;
	private pendingRefreshRequest = false;
	private dragEdgeScrollListener: ((e: MouseEvent) => void) | null = null;
	private dragEdgeScrollTimeout: number | null = null;
	private lastEdgeScrollTime = 0;
	private refreshRafId: number | null = null;
	private lastMobileTapTime = 0;
	private previousViewState: { date: Date; viewType: string } | null = null;
	private lastFocusedEventInfo: CalendarEventData | null = null;
	private mouseDownTime = 0;
	private isHandlingSelection = false;
	private isDraggingCalendarEvent = false;
	private draggingCalendarEventFilePath: string | null = null;

	private getToolbarComponentDefinitions() {
		return [
			{
				id: "searchInput",
				init: () => this.searchFilter.initialize(this.calendar!, this.container),
			},
			{
				id: "expressionFilter",
				init: () => this.expressionFilter.initialize(this.calendar!, this.container),
			},
			{
				id: "filterPresets",
				init: () => this.filterPresetSelector.initialize(this.calendar!, this.container),
			},
			{
				id: "untrackedEvents",
				init: () => {
					this.untrackedEventsDropdown = new UntrackedEventsDropdown(this.app, this.bundle);
					this.untrackedEventsDropdown.initialize(this.calendar!, this.container);
				},
			},
		];
	}

	constructor(
		leaf: WorkspaceLeaf,
		private bundle: CalendarBundle
	) {
		super(leaf);
		this.viewType = getCalendarViewType(bundle.calendarId);
		this.eventContextMenu = new EventContextMenu(this.app, bundle, this);
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

	private buildBatchButtons(): Record<string, ExtendedButtonInput> {
		const bsm = this.batchSelectionManager!;
		const clsBase = cls("batch-action-btn");

		return {
			batchCounter: {
				text: this.getSelectedEventsButtonText(),
				click: () => {
					void this.showSelectedEventsModal();
				},
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
				click: () => {
					void bsm.executeDuplicate();
				},
				className: `${clsBase} ${cls("duplicate-btn")}`,
			},
			batchMoveBy: {
				text: "Move By",
				click: () => bsm.executeMoveBy(),
				className: `${clsBase} ${cls("move-by-btn")}`,
			},
			batchCloneNext: {
				text: "Clone Next",
				click: () => {
					void bsm.executeClone(1);
				},
				className: `${clsBase} ${cls("clone-next-btn")}`,
			},
			batchClonePrev: {
				text: "Clone Prev",
				click: () => {
					void bsm.executeClone(-1);
				},
				className: `${clsBase} ${cls("clone-prev-btn")}`,
			},
			batchMoveNext: {
				text: "Move Next",
				click: () => {
					void bsm.executeMove(1);
				},
				className: `${clsBase} ${cls("move-next-btn")}`,
			},
			batchMovePrev: {
				text: "Move Prev",
				click: () => {
					void bsm.executeMove(-1);
				},
				className: `${clsBase} ${cls("move-prev-btn")}`,
			},
			batchOpenAll: {
				text: "Open",
				click: () => {
					void bsm.executeOpenAll();
				},
				className: `${clsBase} ${cls("open-all-btn")}`,
			},
			batchSkip: {
				text: "Skip",
				click: () => {
					void bsm.executeSkip();
				},
				className: `${clsBase} ${cls("skip-btn")}`,
			},
			batchMarkAsDone: {
				text: "Done",
				click: () => {
					void bsm.executeMarkAsDone();
				},
				className: `${clsBase} ${cls("mark-done-btn")}`,
			},
			batchMarkAsNotDone: {
				text: "Not Done",
				click: () => {
					void bsm.executeMarkAsNotDone();
				},
				className: `${clsBase} ${cls("mark-not-done-btn")}`,
			},
			batchCategories: {
				text: "Categories",
				click: () => {
					void this.openCategoryAssignModal();
				},
				className: `${clsBase} ${cls("categories-btn")}`,
			},
			batchFrontmatter: {
				text: "Frontmatter",
				click: () => {
					void this.openBatchFrontmatterModal();
				},
				className: `${clsBase} ${cls("frontmatter-btn")}`,
			},
			batchDelete: {
				text: "Delete",
				click: () => {
					void bsm.executeDelete();
				},
				className: `${clsBase} ${cls("delete-btn")}`,
			},
			batchExit: {
				text: "Exit",
				click: () => this.toggleBatchSelection(),
				className: `${clsBase} ${cls("exit-btn")}`,
			},
		};
	}

	private buildRegularButtons(): Record<string, ExtendedButtonInput> {
		return {
			createEvent: {
				text: "Create Event",
				click: () => this.openCreateEventModal(),
			},
			now: {
				text: "Now",
				click: () => this.scrollToNow(),
			},
			zoomLevel: this.zoomManager.createZoomLevelButton(),
			batchSelect: {
				text: "Batch Select",
				click: () => this.toggleBatchSelection(),
			},
			filteredEvents: {
				text: "", // Don't set text here - it will be set by applyFilteredEventsButtonState
				click: () => {
					void this.showFilteredEventsModal();
				},
				className: this.filteredEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
			skippedEvents: {
				text: "", // Don't set text here - it will be set by applySkippedEventsButtonState
				click: () => {
					void this.showSkippedEventsModal();
				},
				className: this.skippedEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
			recurringEvents: {
				text: "", // Don't set text here - it will be set by applyEnabledRecurringEventsButtonState
				click: () => {
					void this.showRecurringEventsModal();
				},
				className: this.enabledRecurringEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
		};
	}

	private buildToolbarConfig(inSelectionMode: boolean): {
		headerToolbar: { left: string; center: string; right: string };
		customButtons: Record<string, ExtendedButtonInput>;
	} {
		const viewSwitchers = "dayGridMonth,timeGridWeek,timeGridDay,listWeek";

		if (inSelectionMode) {
			const left = "prev,next today";
			const settings = this.bundle.settingsStore.currentSettings;

			const rightButtons = ["batchCounter", ...settings.batchActionButtons, "batchExit"];
			const right = rightButtons.join(" ");

			return {
				headerToolbar: { left, center: "title", right },
				customButtons: this.buildBatchButtons(),
			};
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const toolbarButtons = new Set(settings.toolbarButtons);

		const leftItems: string[] = [];
		if (toolbarButtons.has("prevNext")) {
			leftItems.push("prev", "next");
		}
		if (toolbarButtons.has("today")) {
			leftItems.push("today");
		}
		if (toolbarButtons.has("now")) {
			leftItems.push("now");
		}
		if (toolbarButtons.has("createEvent")) {
			leftItems.push("createEvent");
		}
		if (toolbarButtons.has("zoomLevel")) {
			leftItems.push("zoomLevel");
		}

		const left = leftItems.length > 0 ? leftItems.join(" ") : "";
		const right = `filteredEvents recurringEvents skippedEvents batchSelect ${viewSwitchers}`;

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
		// Cast to CustomButtonInput - className is accepted at runtime but not in FullCalendar's types
		this.calendar.setOption("customButtons", customButtons as Record<string, CustomButtonInput>);

		setTimeout(() => {
			if (!inSelectionMode) {
				this.applyFilteredEventsButtonState();
				this.applySkippedEventsButtonState();
				this.applyEnabledRecurringEventsButtonState();
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

	private updateEnabledRecurringEventsButton(): void {
		if (!this.calendar) return; // Keep existing guard for recurring manager access

		const enabledEvents = this.bundle.recurringEventManager.getEnabledRecurringEvents();
		const count = enabledEvents.length;

		this.enabledRecurringEventsCount = count;
		this.applyEnabledRecurringEventsButtonState();
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

	private applyEnabledRecurringEventsButtonState(): void {
		if (!this.calendar) return;
		const text = this.getEnabledRecurringEventsButtonText();
		const tooltip = `${this.enabledRecurringEventsCount} recurring event${this.enabledRecurringEventsCount === 1 ? "" : "s"}`;
		this.updateButtonElement(".fc-recurringEvents-button", text, this.enabledRecurringEventsCount > 0, tooltip);
	}

	private getFilteredEventsButtonText(): string {
		return `${this.filteredEventsCount} filtered`;
	}

	private getSkippedEventsButtonText(): string {
		return `${this.skippedEventsCount} skipped`;
	}

	private getEnabledRecurringEventsButtonText(): string {
		return `${this.enabledRecurringEventsCount} recurring`;
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

		// Only update if text has changed to prevent unnecessary DOM manipulation and duplication
		if (btn.textContent !== text) {
			btn.textContent = text;
		}

		if (tooltip !== undefined && btn.title !== tooltip) {
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
		cleanupButton(".fc-recurringEvents-button");
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

		const originalOnClose = modal.onClose.bind(modal) as () => void;
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
			() => {
				if (!this.calendar) throw new Error("Calendar not initialized");

				const view = this.calendar.view;
				if (!view) throw new Error("Calendar view not available");

				const start = toLocalISOString(view.activeStart);
				const end = toLocalISOString(view.activeEnd);
				const skippedEvents = this.bundle.eventStore.getSkippedEvents({
					start,
					end,
				});

				return new SkippedEventsModal(this.app, this.bundle, skippedEvents);
			}
		);
	}

	async showRecurringEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.recurringEventsModal,
			(modal) => {
				this.recurringEventsModal = modal;
				// Refresh the button count when modal closes
				if (!modal) {
					this.updateEnabledRecurringEventsButton();
				}
			},
			() => {
				return new RecurringEventsModal(this.app, this.bundle, this);
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

	async showDailyStatsModal(date?: Date): Promise<void> {
		await this.toggleModal(
			() => this.dailyStatsModal,
			(modal) => {
				this.dailyStatsModal = modal;
			},
			() => {
				const currentDate = date || this.calendar?.getDate() || new Date();
				const viewType = this.calendar?.view?.type;
				return new DailyStatsModal(this.app, this.bundle, currentDate, viewType);
			}
		);
	}

	async showWeeklyStatsModal(date?: Date): Promise<void> {
		await this.toggleModal(
			() => this.weeklyStatsModal,
			(modal) => {
				this.weeklyStatsModal = modal;
			},
			() => {
				const currentDate = date || this.calendar?.getDate() || new Date();
				return new WeeklyStatsModal(this.app, this.bundle, currentDate);
			}
		);
	}

	async showMonthlyStatsModal(date?: Date): Promise<void> {
		await this.toggleModal(
			() => this.monthlyStatsModal,
			(modal) => {
				this.monthlyStatsModal = modal;
			},
			() => {
				const currentDate = date || this.calendar?.getDate() || new Date();
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

	async showIntervalEventsModal(): Promise<void> {
		if (!this.calendar?.view) return;

		const view = this.calendar.view;
		const viewType = view.type;

		const adjustedStart = new Date(view.currentStart);
		adjustedStart.setMinutes(adjustedStart.getMinutes() - 1);
		const startDate = stripISOSuffix(toLocalISOString(adjustedStart));

		const adjustedEnd = new Date(view.currentEnd);
		adjustedEnd.setMinutes(adjustedEnd.getMinutes() - 1);
		const endDate = stripISOSuffix(toLocalISOString(adjustedEnd));

		let intervalLabel = "";
		if (viewType.includes("Day")) {
			const date = new Date(view.currentStart);
			intervalLabel = date.toLocaleDateString("en-US", {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		} else if (viewType.includes("Week")) {
			const start = new Date(view.currentStart);
			const end = new Date(view.currentEnd);
			end.setDate(end.getDate() - 1);
			intervalLabel = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
		} else if (viewType.includes("Month")) {
			const date = new Date(view.currentStart);
			intervalLabel = date.toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			});
		} else {
			intervalLabel = "Current View";
		}

		await this.toggleModal(
			() => this.intervalEventsModal,
			(modal) => {
				this.intervalEventsModal = modal;
			},
			() => {
				return new IntervalEventsModal(
					this.app,
					intervalLabel,
					startDate,
					endDate,
					this.bundle.settingsStore.currentSettings
				);
			}
		);
	}

	navigateToDate(date: Date, viewType?: string): void {
		if (!this.calendar) return;

		this.storePreviousViewState();

		if (viewType) {
			this.calendar.changeView(viewType);
		}

		this.calendar.gotoDate(date);
	}

	scrollToNow(): void {
		if (!this.calendar) return;

		const currentView = this.calendar.view.type;
		let targetElement: Element | null = null;

		if (currentView === "timeGridWeek" || currentView === "timeGridDay") {
			// For time grid views, find the now indicator line
			targetElement = this.container.querySelector(".fc-timegrid-now-indicator-line");
		} else if (currentView === "dayGridMonth") {
			// For month view, find today's cell
			targetElement = this.container.querySelector(".fc-day-today");
		}

		// Center the target element if found
		if (targetElement) {
			this.scrollElementToCenter(targetElement);
		}
	}

	private scrollElementToCenter(element: Element): void {
		const viewContent = this.containerEl.querySelector(".view-content");
		if (!viewContent) return;

		const elementRect = element.getBoundingClientRect();
		const viewContentRect = viewContent.getBoundingClientRect();

		// Calculate scroll position to center the element
		const scrollTop =
			viewContent.scrollTop +
			elementRect.top -
			viewContentRect.top -
			viewContent.clientHeight / 2 +
			elementRect.height / 2;

		viewContent.scrollTop = scrollTop;
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

	private storePreviousViewState(): void {
		if (!this.calendar) return;

		const currentDate = this.calendar.getDate();
		const currentViewType = this.calendar.view.type;

		this.previousViewState = {
			date: new Date(currentDate),
			viewType: currentViewType,
		};
	}

	navigateBack(): boolean {
		if (!this.calendar || !this.previousViewState) {
			return false;
		}

		const { date, viewType } = this.previousViewState;

		// Don't store the current state as previous when going back
		// (to avoid creating a navigation loop)
		const tempPrevious = this.previousViewState;
		this.previousViewState = null;

		this.calendar.changeView(viewType);
		this.calendar.gotoDate(date);

		// Restore the previous state reference
		this.previousViewState = tempPrevious;

		return true;
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

		// Filter to only timed events (exclude all-day events and virtual events)
		const timedEvents = events.filter((event) => {
			const eventStart = event.start;
			if (!eventStart) return false;
			// Exclude virtual events from being highlighted
			if (event.extendedProps?.isVirtual) return false;
			// Always ignore all-day events - only highlight timed events
			if (event.allDay) return false;
			return true;
		});

		// First, find the first timed event that is currently active (now is between start and end)
		const activeTimedEvents = timedEvents.filter((event) => {
			const eventStart = event.start!;
			const eventEnd = event.end || eventStart;
			// Check if now is between start and end
			return eventStart <= now && now <= eventEnd;
		});

		// If there are active events, highlight all of them
		if (activeTimedEvents.length > 0) {
			for (const event of activeTimedEvents) {
				result.add(event.id);
			}
			return result;
		}

		// If no active timed events, find the next upcoming timed event (closest future start time)
		const upcomingTimedEvents = timedEvents
			.filter((event) => {
				const eventStart = event.start!;
				return eventStart > now;
			})
			.sort((a, b) => {
				const aStart = a.start?.getTime() || 0;
				const bStart = b.start?.getTime() || 0;
				return aStart - bStart;
			});

		// Return the ID of the first upcoming timed event
		if (upcomingTimedEvents.length > 0) {
			result.add(upcomingTimedEvents[0].id);
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

	private isMobileView(): boolean {
		return window.innerWidth <= 768;
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

	private clearCategoryHighlight(): void {
		if (this.categoryHighlightTimeout !== null) {
			window.clearTimeout(this.categoryHighlightTimeout);
			this.categoryHighlightTimeout = null;
		}

		if (this.currentCategoryHighlightClass !== null) {
			for (const eventId of this.highlightedCategoryEvents) {
				toggleEventHighlight(eventId, this.currentCategoryHighlightClass, false);
			}
			this.highlightedCategoryEvents.clear();
			this.currentCategoryHighlightClass = null;
		}
	}

	private findEventIdsByPredicate(predicate: (filePath: string) => boolean): Set<string> {
		const result = new Set<string>();
		if (!this.calendar) return result;

		const events = this.calendar.getEvents();
		for (const event of events) {
			if (event.extendedProps.isVirtual) continue;

			const filePath = event.extendedProps.filePath as string | undefined;
			if (filePath && predicate(filePath)) {
				result.add(event.id);
			}
		}
		return result;
	}

	private highlightCategoryEvents(getEventIds: () => Set<string>): void {
		if (!this.calendar) return;

		const highlightClass = cls("event-category-highlight");
		this.clearCategoryHighlight();

		const eventIds = getEventIds();

		for (const eventId of eventIds) {
			toggleEventHighlight(eventId, highlightClass, true);
		}

		this.highlightedCategoryEvents = eventIds;
		this.currentCategoryHighlightClass = highlightClass;

		this.categoryHighlightTimeout = window.setTimeout(() => {
			this.clearCategoryHighlight();
		}, 10000);
	}

	public highlightEventsWithoutCategories(): void {
		this.highlightCategoryEvents(() => {
			const filesWithCategories = this.bundle.categoryTracker.getAllFilesWithCategories();
			return this.findEventIdsByPredicate((filePath) => !filesWithCategories.has(filePath));
		});
	}

	public showCategorySelectModal(): void {
		const modal = new CategorySelectModal(this.app, this.bundle.categoryTracker, (category: string) => {
			this.highlightEventsWithCategory(category);
		});
		modal.open();
	}

	public highlightEventsWithCategory(category: string): void {
		this.highlightCategoryEvents(() => {
			const events = this.bundle.categoryTracker.getEventsWithCategory(category);
			const filePaths = new Set(events.map((e) => e.ref.filePath));
			return this.findEventIdsByPredicate((filePath) => filePaths.has(filePath));
		});
	}

	private initializeCalendar(container: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const initialView = this.isMobileView() ? settings.defaultMobileView : settings.defaultView;

		this.calendar = new Calendar(container, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],

			timeZone: "local",

			initialView,

			nowIndicator: settings.nowIndicator,

			stickyHeaderDates: settings.stickyDayHeaders,

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

				const isAllDay = arg.event.allDay;
				let isPast: boolean;

				if (isAllDay) {
					// For all-day events, compare dates only (not times)
					// An all-day event is past only if its date is before today
					const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
					const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
					isPast = eventDate < today;
				} else {
					// For timed events, check if end time is before now
					isPast = eventEnd < now;
				}

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

			dayMaxEventRows: this.isMobileView() ? settings.mobileMaxEventsPerDay : settings.desktopMaxEventsPerDay || false,

			windowResize: () => {
				const currentSettings = this.bundle.settingsStore.currentSettings;
				this.calendar?.setOption(
					"dayMaxEventRows",
					this.isMobileView() ? currentSettings.mobileMaxEventsPerDay : currentSettings.desktopMaxEventsPerDay || false
				);
			},

			editable: true,
			eventStartEditable: true,
			eventDurationEditable: true,
			eventResizableFromStart: true,

			selectable: true,
			selectMirror: true,
			unselectAuto: true,
			unselectCancel: ".modal",

			droppable: true,

			// Fix drag mirror positioning for all-day events
			// Positions the drag mirror relative to document.body instead of calendar container
			// This ensures the event box follows the cursor correctly for both all-day and timed events
			fixedMirrorParent: document.body,

			eventReceive: (info) => {
				// External draggable dropped - we handle this in the drop handler instead
				info.revert();
			},

			eventAllow: (_dropInfo, draggedEvent) => {
				return !draggedEvent?.extendedProps.isVirtual;
			},

			eventClick: (info) => {
				if (this.batchSelectionManager?.isInSelectionMode()) {
					if (!info.event.extendedProps.isVirtual) {
						this.batchSelectionManager.handleEventClick(info.event.id);
					}
				} else {
					this.handleEventClick(info, info.el);
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
				this.lastFocusedEventInfo = info.event;

				// Always add context menu for all events (including virtual)
				info.el.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					this.eventContextMenu.show(e, info, info.el, this.container);
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

			eventDragStart: (info) => {
				this.setupDragEdgeScrolling();
				const filePath = info.event.extendedProps?.filePath;
				const isVirtual = info.event.extendedProps?.isVirtual ?? false;
				this.isDraggingCalendarEvent = !isVirtual && typeof filePath === "string" && filePath.length > 0;
				this.draggingCalendarEventFilePath = this.isDraggingCalendarEvent ? filePath : null;
			},

			eventDragStop: (_info) => {
				this.cleanupDragEdgeScrolling();
				this.isDraggingCalendarEvent = false;
				this.draggingCalendarEventFilePath = null;
			},

			eventDrop: (info) => {
				this.cleanupDragEdgeScrolling();
				void this.handleEventDrop(info);
			},

			eventResize: (info) => {
				void this.handleEventResize(info);
			},

			drop: (info) => {
				void this.handleExternalDrop(info);
			},

			dateClick: (info) => {
				// Only handle if not already handling a selection
				if (!this.isHandlingSelection) {
					this.handleDateClick(info);
				}
				// Reset flag after a short delay
				setTimeout(() => {
					this.isHandlingSelection = false;
				}, 50);
			},

			select: (info) => {
				// Check if this was a quick click or an actual drag
				const now = Date.now();
				const timeSinceMouseDown = now - this.mouseDownTime;
				const CLICK_THRESHOLD_MS = 150; // 150ms or less = click, more = drag

				const isQuickClick = timeSinceMouseDown < CLICK_THRESHOLD_MS;

				if (isQuickClick) {
					// Quick click - ignore select, let dateClick handle it
					this.calendar?.unselect();
				} else {
					// Actual drag - handle the selection and prevent dateClick
					this.isHandlingSelection = true;
					this.handleDateSelection(info);
				}
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

		this.initializeToolbarComponents(settings.toolbarButtons);

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
		this.refreshEvents();

		toggleCls(container, "thicker-hour-lines", settings.thickerHourLines);
		toggleCls(container, "sticky-all-day-events", settings.stickyAllDayEvents);
		// Note: sticky-day-headers class is still applied for CSS that depends on both settings
		toggleCls(container, "sticky-day-headers", settings.stickyDayHeaders);

		container.style.setProperty("--all-day-event-height", `${settings.allDayEventHeight}px`);

		this.setupMouseTracking(container);
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
		this.calendar.setOption("stickyHeaderDates", settings.stickyDayHeaders);

		// Update event overlap settings
		this.calendar.setOption("eventOverlap", settings.eventOverlap);
		this.calendar.setOption("slotEventOverlap", settings.slotEventOverlap);
		this.calendar.setOption("eventMaxStack", settings.eventMaxStack);

		this.filterPresetSelector.updatePresets(settings.filterPresets);

		toggleCls(this.container, "thicker-hour-lines", settings.thickerHourLines);
		toggleCls(this.container, "sticky-all-day-events", settings.stickyAllDayEvents);
		// Note: sticky-day-headers class is still applied for CSS that depends on both settings
		toggleCls(this.container, "sticky-day-headers", settings.stickyDayHeaders);

		this.container.style.setProperty("--all-day-event-height", `${settings.allDayEventHeight}px`);

		// Restart or stop upcoming event check based on setting
		if (settings.highlightUpcomingEvent) {
			this.startUpcomingEventCheck();
		} else {
			this.stopUpcomingEventCheck();
		}

		// Schedule refresh with coalescing to batch with paint and avoid refresh storms
		this.scheduleRefreshEvents();
	}

	private initializeToolbarComponents(toolbarButtons: string[]): void {
		if (!this.calendar) return;

		const buttons = new Set(toolbarButtons);
		const components = this.getToolbarComponentDefinitions();

		// Initialize components in reverse order since they insert after zoom button
		// Order will be: Zoom → FilterPresetSelector → ExpressionFilter → SearchInput → Untracked
		for (const component of components) {
			if (buttons.has(component.id)) {
				component.init();
			}
		}
	}

	private scheduleRefreshEvents(): void {
		// Coalesce rapid settings changes (sliders, typing, toggles) into a single refresh per frame
		if (this.refreshRafId !== null) return;

		this.refreshRafId = requestAnimationFrame(() => {
			this.refreshRafId = null;
			this.refreshEvents();
		});
	}

	refreshCalendar(): void {
		this.bundle.refreshCalendar();
	}

	private refreshEvents(): void {
		// Don't refresh events until indexing is complete
		if (!this.calendar || !this.isIndexingComplete || !this.calendar.view) {
			return;
		}

		if (this.isRefreshingEvents) {
			// Mark that a refresh was requested while we're busy
			// This ensures we refresh again after the current one completes
			this.pendingRefreshRequest = true;
			return;
		}

		this.isRefreshingEvents = true;
		this.pendingRefreshRequest = false;
		const { view } = this.calendar;

		// Capture scroll position before touching events
		// The REAL scroller is the Obsidian view-content wrapper
		const viewContent = this.containerEl.querySelector(".view-content");

		// FullCalendar internal scroller (for some views like list)
		const innerScroller = this.container.querySelector(".fc-scroller");

		const viewContentScrollTop = viewContent?.scrollTop ?? 0;
		const innerScrollTop = innerScroller?.scrollTop ?? 0;

		try {
			// Use toLocalISOString to prevent timezone conversion issues
			// FullCalendar's activeStart/activeEnd are local Date objects, but toISOString() converts to UTC
			const start = toLocalISOString(view.activeStart);
			const end = toLocalISOString(view.activeEnd);

			const allEvents = this.bundle.eventStore.getNonSkippedEvents({
				start,
				end,
			});

			const filteredEvents: CalendarEvent[] = [];
			const visibleEvents: CalendarEvent[] = [];

			for (const event of allEvents) {
				const passesSearch = this.searchFilter.shouldInclude({
					meta: event.meta,
					title: event.title,
				});
				const passesExpression = this.expressionFilter.shouldInclude(event);

				if (passesSearch && passesExpression) {
					visibleEvents.push(event);
				} else {
					filteredEvents.push(event);
				}
			}

			this.filteredEvents = filteredEvents;
			this.updateFilteredEventsButton(filteredEvents.length);

			const skippedEvents = this.bundle.eventStore.getSkippedEvents({
				start,
				end,
			});
			this.updateSkippedEventsButton(skippedEvents.length);

			// Update enabled recurring events button
			this.updateEnabledRecurringEventsButton();

			// Convert to FullCalendar event format
			const calendarEvents: PrismaEventInput[] = [];

			for (const event of visibleEvents) {
				// Skip untracked events - they don't have dates
				if (isUntrackedEvent(event)) {
					continue;
				}

				// At this point, TypeScript knows event is TimedEvent | AllDayEvent
				// Both have start, allDay properties
				const trackedEvent: TimedEvent | AllDayEvent = event;

				const classNames = ["regular-event"];
				if (trackedEvent.isVirtual) {
					classNames.push(cls("virtual-event"));
				}
				const eventColor = this.getEventColor(trackedEvent);

				// Strip Z suffix to treat times as naive local times (no timezone conversion)
				const start = trackedEvent.start.replace(/Z$/, "");
				const end = isTimedEvent(trackedEvent) ? trackedEvent.end.replace(/Z$/, "") : undefined;

				const folder = trackedEvent.meta?.folder;
				const folderStr = typeof folder === "string" ? folder : "";

				calendarEvents.push({
					id: trackedEvent.id,
					title: trackedEvent.title, // Keep original title for search/filtering
					start,
					end,
					allDay: trackedEvent.allDay,
					extendedProps: {
						filePath: trackedEvent.ref.filePath,
						folder: folderStr,
						originalTitle: trackedEvent.title,
						frontmatterDisplayData: trackedEvent.meta ?? {},
						isVirtual: trackedEvent.isVirtual,
					},
					backgroundColor: eventColor,
					borderColor: eventColor,
					className: classNames.join(" "),
				});
			}

			// CRITICAL: Remove ALL events and event sources to prevent accumulation
			this.calendar.removeAllEvents();
			this.calendar.removeAllEventSources();

			// Add fresh event source with new events
			this.calendar.addEventSource({
				id: "main-events",
				events: calendarEvents,
			});

			this.updateColorDots();
		} catch (error) {
			console.error("Error refreshing calendar events:", error);
		} finally {
			// Restore scroll after FC finishes layout
			requestAnimationFrame(() => {
				// Re-query in case DOM changed
				const viewContentRestored = this.containerEl.querySelector(".view-content");
				const inner = this.container.querySelector(".fc-scroller");

				if (viewContentRestored) {
					viewContentRestored.scrollTop = viewContentScrollTop;
				}

				if (inner) {
					inner.scrollTop = innerScrollTop;
				}

				// Release the lock after scroll restoration completes
				setTimeout(() => {
					this.isRefreshingEvents = false;

					// If a refresh was requested while we were busy, trigger it now
					// This handles rapid navigation where multiple datesSet events fire
					if (this.pendingRefreshRequest) {
						this.pendingRefreshRequest = false;
						this.refreshEvents();
					}
				}, 50);
			});
		}
	}

	private renderEventContent(arg: EventContentArg): {
		domNodes: HTMLElement[];
	} {
		const event = arg.event;
		const isMobile = this.isMobileView();
		const isMonthView = arg.view.type === "dayGridMonth";

		// Don't create our own fc-event-main - FullCalendar already provides one
		const container = document.createElement("div");
		container.className = cls("fc-event-content-wrapper");

		const settings = this.bundle.settingsStore.currentSettings;
		const displayData = event.extendedProps.frontmatterDisplayData;
		const isSourceRecurring = displayData?.[settings.rruleProp];
		const isPhysicalRecurring = displayData?.[settings.sourceProp];

		if (
			(isSourceRecurring && settings.showSourceRecurringMarker) ||
			(isPhysicalRecurring && settings.showPhysicalRecurringMarker)
		) {
			const markerEl = document.createElement("div");
			markerEl.className = cls("event-marker");
			markerEl.textContent = isSourceRecurring ? settings.sourceRecurringMarker : settings.physicalRecurringMarker;
			container.appendChild(markerEl);
		}

		const headerEl = document.createElement("div");
		headerEl.className = cls("fc-event-header");

		// On mobile monthly view, hide time to save space - show only event name
		const showTime = !event.allDay && event.start && !(isMobile && isMonthView);
		if (showTime) {
			const timeEl = document.createElement("div");
			timeEl.className = cls("fc-event-time");
			timeEl.textContent = arg.timeText;
			headerEl.appendChild(timeEl);
		}

		// Add title
		const titleEl = document.createElement("div");
		titleEl.className = cls("fc-event-title-custom");
		const title = cleanupTitle(event.title);
		titleEl.textContent = title;
		headerEl.appendChild(titleEl);

		container.appendChild(headerEl);

		// On mobile only: hide display properties to save space (monthly)
		const hideProperties = isMobile && isMonthView;
		if (!hideProperties) {
			const displayPropertiesList = event.allDay
				? settings.frontmatterDisplayPropertiesAllDay
				: settings.frontmatterDisplayProperties;

			const displayProperties = displayData ? getDisplayProperties(displayData, displayPropertiesList) : [];
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
					renderPropertyValue(valueEl, value, {
						app: this.app,
						linkClassName: cls("fc-event-prop-link"),
						addSpacePrefixToText: true,
					});
					propEl.appendChild(valueEl);

					propsContainer.appendChild(propEl);
				}
				container.appendChild(propsContainer);
			}
		}

		return { domNodes: [container] };
	}

	private getEventColor(event: Pick<CalendarEvent, "meta">): string {
		const frontmatter = event.meta ?? {};
		const settings = this.bundle.settingsStore.currentSettings;

		// Check if this is a CalDAV-synced event - integration color takes priority
		const caldavSettings = this.bundle.getCalDAVSettings();
		const caldavProp = settings.caldavProp;

		if (frontmatter[caldavProp]) {
			// Event has CalDAV metadata - apply integration color with priority
			return caldavSettings.integrationEventColor;
		}

		// Normalize frontmatter to ensure all properties referenced in color rules exist
		// This prevents errors when properties are undefined (e.g., Category.includes())
		const normalizedFrontmatter = normalizeFrontmatterForColorEvaluation(frontmatter, settings.colorRules);
		return this.colorEvaluator.evaluateColor(normalizedFrontmatter);
	}

	private updateColorDots(): void {
		if (!this.calendar) return;

		const settings = this.bundle.settingsStore.currentSettings;

		// Remove existing dots first
		const existingDots = Array.from(this.container.querySelectorAll(`.${cls("day-color-dots")}`));
		for (const dot of existingDots) {
			dot.remove();
		}

		// Only render if setting is enabled and on monthly view
		const viewType = this.calendar.view?.type;
		if (!settings.showColorDots || viewType !== "dayGridMonth") return;

		// Get all day cells
		const dayCells = Array.from(this.container.querySelectorAll(".fc-daygrid-day"));
		const events = this.calendar.getEvents();
		const maxDots = this.isMobileView() ? 6 : 8;

		for (const dayCell of dayCells) {
			const dateAttr = dayCell.getAttribute("data-date");
			if (!dateAttr) continue;

			// Parse the date
			const dayDate = new Date(dateAttr);
			const dayStart = new Date(dayDate);
			dayStart.setHours(0, 0, 0, 0);
			const dayEnd = new Date(dayDate);
			dayEnd.setHours(23, 59, 59, 999);

			// Get events for this day
			const dayEvents = events.filter((event) => {
				const eventStart = event.start;
				if (!eventStart) return false;
				const eventStartTime = eventStart.getTime();
				return eventStartTime >= dayStart.getTime() && eventStartTime <= dayEnd.getTime();
			});

			if (dayEvents.length === 0) continue;

			// Collect unique colors
			const colors = new Set<string>();
			for (const event of dayEvents) {
				if (colors.size >= maxDots) break;
				const color = event.backgroundColor || event.borderColor || "#3788d8";
				colors.add(color);
			}

			// Create dots container
			const dotsContainer = document.createElement("div");
			dotsContainer.className = cls("day-color-dots");

			for (const color of colors) {
				const dot = document.createElement("div");
				dot.className = cls("day-color-dot");
				dot.style.setProperty("--dot-color", color);
				dotsContainer.appendChild(dot);
			}

			const dayTop = dayCell.querySelector(".fc-daygrid-day-top");
			if (dayTop) {
				dayTop.appendChild(dotsContainer);
			}
		}
	}

	private handleEventClick(
		info: {
			event: Pick<CalendarEventData, "title" | "extendedProps" | "start" | "end" | "allDay">;
		},
		eventEl: HTMLElement
	): void {
		const event = info.event;
		const filePath = event.extendedProps.filePath;
		const isVirtual = event.extendedProps.isVirtual;

		// For virtual events, show preview of the source event
		if (isVirtual && filePath && typeof filePath === "string") {
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
					const previewEvent: PreviewEventData = {
						title: sourceEvent.title,
						start: null,
						end: null,
						allDay: false,
						extendedProps: sourceEvent.extendedProps,
					};
					new EventPreviewModal(this.app, this.bundle, previewEvent).open();
					return;
				}
			}
		}

		// On mobile: single tap = context menu, double tap = open note
		if (this.isMobileView()) {
			const currentTime = Date.now();
			const timeSinceLastTap = currentTime - this.lastMobileTapTime;
			const DOUBLE_TAP_DELAY = 300;

			if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
				// Double tap - open the note
				this.lastMobileTapTime = 0;
				if (filePath && typeof filePath === "string") {
					void this.app.workspace.openLinkText(filePath, "", false);
				}
				return;
			}

			// Single tap - show context menu
			this.lastMobileTapTime = currentTime;
			const rect = eventEl.getBoundingClientRect();
			const menuEvent = {
				title: event.title,
				start: event.start,
				end: event.end,
				allDay: event.allDay,
				extendedProps: event.extendedProps,
			};
			this.eventContextMenu.show(
				{ x: rect.left + rect.width / 2, y: rect.top },
				{ event: menuEvent },
				eventEl,
				this.container
			);
			return;
		}

		// For regular and physical events, open the file
		if (filePath && typeof filePath === "string") {
			void this.app.workspace.openLinkText(filePath, "", false);
		}
	}

	private handleEventMount(info: EventMountInfo): void {
		if (info.event.extendedProps.isVirtual) {
			info.el.classList.add(cls("virtual-event-italic"));
		}

		const element = info.el;
		const event = info.event;

		// Apply event color
		const eventColor = this.getEventColor({
			meta: event.extendedProps.frontmatterDisplayData ?? {},
		});

		element.style.setProperty("--event-color", eventColor);
		element.classList.add(cls("calendar-event"));

		// Set opacity CSS variable for past events
		const now = new Date();
		const eventStart = event.start;
		const eventEnd = event.end || eventStart;
		let isPast: boolean;

		if (eventEnd === null) {
			isPast = false;
		} else if (event.allDay) {
			// For all-day events, compare dates only (not times)
			// An all-day event is past only if its date is before today
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
			isPast = eventDate < today;
		} else {
			// For timed events, check if end time is before now
			isPast = eventEnd < now;
		}

		if (isPast) {
			const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
			const opacity = contrast / 100;
			element.style.setProperty("--past-event-opacity", opacity.toString());
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const tooltipParts = [];

		let firstLine = cleanupTitle(event.title);

		if (event.start) {
			if (event.allDay) {
				// For all-day events: NAME - DATE
				const dateStr = event.start.toLocaleDateString("en-US", {
					weekday: "short",
					month: "short",
					day: "numeric",
					year: "numeric",
				});
				firstLine += ` - ${dateStr}`;
			} else if (event.end) {
				// For timed events: NAME - START - END (DURATION)
				const startStr = event.start.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
				});

				const endStr = event.end.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
				});
				const duration = calculateDuration(event.start, event.end);
				firstLine += ` - ${startStr} - ${endStr} (${duration})`;
			} else {
				// For timed events without end time: NAME - START
				const startStr = event.start.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
				});
				firstLine += ` - ${startStr}`;
			}
		}

		tooltipParts.push(firstLine);

		const displayData = event.extendedProps.frontmatterDisplayData;
		const displayPropertiesList = event.allDay
			? settings.frontmatterDisplayPropertiesAllDay
			: settings.frontmatterDisplayProperties;

		const displayProperties = displayData ? getDisplayProperties(displayData, displayPropertiesList) : [];
		for (const [prop, value] of displayProperties) {
			const displayValue = extractPropertyText(value);
			tooltipParts.push(`${prop}: ${displayValue}`);
		}

		element.setAttribute("title", tooltipParts.join("\n"));
		element.addClass(cls("calendar-event"));
	}

	private setupMouseTracking(container: HTMLElement): void {
		container.addEventListener("mousedown", () => {
			this.mouseDownTime = Date.now();
		});
	}

	private handleDateClick(info: { date: Date; allDay: boolean }): void {
		const clickedDate = info.date;
		const isAllDay = info.allDay;
		const settings = this.bundle.settingsStore.currentSettings;

		const endDate = new Date(clickedDate);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		const newEvent = {
			title: "",
			start: toLocalISOString(clickedDate),
			end: isAllDay ? undefined : toLocalISOString(endDate),
			allDay: isAllDay,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		new EventCreateModal(this.app, this.bundle, newEvent).open();
		this.calendar?.unselect();
	}

	private handleDateSelection(info: { start: Date; end: Date; allDay: boolean }): void {
		const newEvent = {
			title: "",
			start: toLocalISOString(info.start),
			end: toLocalISOString(info.end),
			allDay: info.allDay,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		new EventCreateModal(this.app, this.bundle, newEvent).open();
		this.calendar?.unselect();
	}

	openCreateEventModal(autoStartStopwatch = false): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const now = new Date();
		const roundedStart = roundToNearestHour(now);

		const endDate = new Date(roundedStart);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		const newEvent = {
			title: "",
			start: toLocalISOString(roundedStart),
			end: toLocalISOString(endDate),
			allDay: false,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		const modal = new EventCreateModal(this.app, this.bundle, newEvent);

		if (autoStartStopwatch) {
			modal.setAutoStartStopwatch(true);
		}

		modal.open();
	}

	openEditModalForFocusedEvent(): void {
		if (!this.lastFocusedEventInfo) {
			return;
		}

		const event = this.lastFocusedEventInfo;

		const eventInfo = event.extendedProps?.isVirtual
			? getSourceEventInfoFromVirtual(event, this.bundle.eventStore)
			: {
					title: event.title,
					start: event.start,
					end: event.end,
					allDay: event.allDay,
					extendedProps: event.extendedProps,
				};

		if (!eventInfo) {
			return;
		}

		this.eventContextMenu.openEditModal(eventInfo);
	}

	private fillFocusedEventTime(
		propertyGetter: (settings: SingleCalendarConfig) => string,
		timeValueGetter: (event: CalendarEventData, filePath: string) => string | undefined
	): void {
		if (!this.lastFocusedEventInfo) {
			return;
		}

		const event = this.lastFocusedEventInfo;

		if (event.extendedProps?.isVirtual) {
			return;
		}

		const filePath = event.extendedProps?.filePath;
		if (!filePath || typeof filePath !== "string") {
			return;
		}

		const timeValue = timeValueGetter(event, filePath);
		if (!timeValue) {
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const propertyName = propertyGetter(settings);

		void this.bundle.commandManager.executeCommand(
			new FillTimeCommand(this.app, this.bundle, filePath, propertyName, timeValue)
		);
	}

	setFocusedEventStartToNow(): void {
		this.fillFocusedEventTime(
			(settings) => settings.startProp,
			() => toLocalISOString(new Date())
		);
	}

	setFocusedEventEndToNow(): void {
		this.fillFocusedEventTime(
			(settings) => settings.endProp,
			() => toLocalISOString(new Date())
		);
	}

	fillFocusedEventStartFromPrevious(): void {
		this.fillFocusedEventTime(
			(settings) => settings.startProp,
			(event, filePath) => {
				const previousEvent = findAdjacentEvent(this.bundle.eventStore, event.start, filePath, "previous");
				return previousEvent && isTimedEvent(previousEvent) ? previousEvent.end : undefined;
			}
		);
	}

	fillFocusedEventEndFromNext(): void {
		this.fillFocusedEventTime(
			(settings) => settings.endProp,
			(event, filePath) => {
				const nextEvent = findAdjacentEvent(this.bundle.eventStore, event.start, filePath, "next");
				return nextEvent?.start;
			}
		);
	}

	async openCategoryAssignModal(): Promise<void> {
		if (!this.batchSelectionManager) return;

		const categories = this.bundle.categoryTracker.getCategoriesWithColors();
		const defaultColor = this.bundle.settingsStore.currentSettings.defaultNodeColor;
		const selectedEvents = this.batchSelectionManager.getSelectedEvents();
		const settings = this.bundle.settingsStore.currentSettings;

		const commonCategories = getCommonCategories(this.app, selectedEvents, settings.categoryProp);

		const modal = new CategoryAssignModal(
			this.app,
			categories,
			defaultColor,
			commonCategories,
			(selectedCategories: string[]) => {
				if (this.batchSelectionManager) {
					this.batchSelectionManager.executeAssignCategories(selectedCategories);
				}
			}
		);
		modal.open();
	}

	async openBatchFrontmatterModal(): Promise<void> {
		if (!this.batchSelectionManager) return;

		const settings = this.bundle.settingsStore.currentSettings;
		const selectedEvents = this.batchSelectionManager.getSelectedEvents();

		const modal = new BatchFrontmatterModal(
			this.app,
			settings,
			selectedEvents,
			(propertyUpdates: Map<string, string | null>) => {
				if (this.batchSelectionManager) {
					this.batchSelectionManager.executeUpdateFrontmatter(propertyUpdates);
				}
			}
		);
		modal.open();
	}

	private async handleEventUpdate(info: EventUpdateInfo, errorMessage: string): Promise<void> {
		if (info.event.extendedProps.isVirtual === true) {
			info.revert();
			return;
		}

		const filePath = info.event.extendedProps.filePath;
		if (!filePath || typeof filePath !== "string") {
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

	/**
	 * Extracts plain object data from FullCalendar EventApi objects.
	 * EventApi uses getters on the prototype, so spread operator doesn't work.
	 */
	private extractEventUpdateInfo(info: {
		event: CalendarEventData;
		oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay">;
		revert: () => void;
	}): EventUpdateInfo | null {
		if (!info.event.start) {
			info.revert();
			return null;
		}

		return {
			event: {
				title: info.event.title,
				start: info.event.start,
				end: info.event.end,
				allDay: info.event.allDay,
				extendedProps: info.event.extendedProps,
			},
			oldEvent: {
				start: info.oldEvent.start || new Date(),
				end: info.oldEvent.end,
				allDay: info.oldEvent.allDay,
			},
			revert: info.revert,
		};
	}

	private async handleEventDrop(info: {
		event: CalendarEventData;
		oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay">;
		revert: () => void;
	}): Promise<void> {
		const updateInfo = this.extractEventUpdateInfo(info);
		if (updateInfo) {
			await this.handleEventUpdate(updateInfo, "Error updating event dates:");
		}
	}

	private async handleEventResize(info: {
		event: CalendarEventData;
		oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay">;
		revert: () => void;
	}): Promise<void> {
		const updateInfo = this.extractEventUpdateInfo(info);
		if (updateInfo) {
			await this.handleEventUpdate(updateInfo, "Error updating event duration:");
		}
	}

	private handleGlobalPointerUpForUntrackedDrop = (e: PointerEvent): void => {
		if (!this.isDraggingCalendarEvent || !this.draggingCalendarEventFilePath) return;

		// If dropdown was temporarily hidden during drag, restore it before hit-testing.
		this.untrackedEventsDropdown?.restoreIfTemporarilyHidden();

		const x = e.clientX;
		const y = e.clientY;

		const buttonEl = this.container?.querySelector(`.${cls("untracked-dropdown-button")}`);
		const dropdownEl = this.container?.querySelector(`.${cls("untracked-dropdown")}`);

		const hitByRect = isPointInsideElement(x, y, buttonEl) || isPointInsideElement(x, y, dropdownEl);

		if (!hitByRect) return;

		// Prevent the trailing click after pointerup from being treated as an outside click and closing the dropdown.
		this.untrackedEventsDropdown?.ignoreOutsideClicksFor(1500);

		void this.moveCalendarEventToUntracked(this.draggingCalendarEventFilePath);
	};

	private async moveCalendarEventToUntracked(filePath: string): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		const propertyUpdates = new Map<string, string | null>();
		propertyUpdates.set(settings.startProp, null);
		propertyUpdates.set(settings.endProp, null);
		propertyUpdates.set(settings.dateProp, null);
		propertyUpdates.set(settings.allDayProp, null);

		const command = new UpdateFrontmatterCommand(this.app, this.bundle, filePath, propertyUpdates);
		await this.bundle.commandManager.executeCommand(command);
	}

	private async handleExternalDrop(info: DropArg): Promise<void> {
		const filePath = info.draggedEl.getAttribute("data-file-path");

		if (filePath) {
			try {
				const file = this.app.vault.getAbstractFileByPath(filePath);

				if (file instanceof TFile) {
					const settings = this.bundle.settingsStore.currentSettings;
					const localISO = toLocalISOString(info.date);
					const dateStr = localISO.split("T")[0];
					const timeStr = localISO.split("T")[1];

					const propertyUpdates = new Map<string, string | null>();

					if (info.allDay) {
						propertyUpdates.set(settings.dateProp, dateStr);
						propertyUpdates.set(settings.allDayProp, "true");
						propertyUpdates.set(settings.startProp, null);
						propertyUpdates.set(settings.endProp, null);
					} else {
						const startDateTime = `${dateStr}T${timeStr}`;
						const endTime = calculateEndTime(timeStr, settings.defaultDurationMinutes);
						const endDateTime = `${dateStr}T${endTime}`;

						propertyUpdates.set(settings.startProp, startDateTime);
						propertyUpdates.set(settings.endProp, endDateTime);
						propertyUpdates.set(settings.allDayProp, "false");
						propertyUpdates.set(settings.dateProp, null);
					}

					const command = new UpdateFrontmatterCommand(this.app, this.bundle, filePath, propertyUpdates);
					await this.bundle.commandManager.executeCommand(command);
				}
			} catch (error) {
				console.error("[CalendarView] Error handling drop:", error);
			}
		}
	}

	private setupKeyboardShortcuts(): void {
		this.containerEl.setAttribute("tabindex", "-1");

		const keydownHandler = (e: KeyboardEvent) => {
			if (!this.calendar) return;

			// Only handle arrow keys without any modifiers
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

			// Check if keyboard navigation is enabled
			const settings = this.bundle.settingsStore.currentSettings;
			if (!settings.enableKeyboardNavigation) return;

			// Don't navigate if any filter input is focused
			if (this.searchFilter.isFocused() || this.expressionFilter.isFocused()) return;

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
		this.initializeCalendar(this.container);

		this.setupKeyboardShortcuts();

		// Detect calendar-event drag release point reliably (FullCalendar's jsEvent in eventDragStop can be stale
		// when releasing outside the calendar grid, e.g. over toolbar/dropdowns).
		document.addEventListener("pointerup", this.handleGlobalPointerUpForUntrackedDrop, true);
		this.register(() => {
			document.removeEventListener("pointerup", this.handleGlobalPointerUpForUntrackedDrop, true);
		});

		setTimeout(() => this.containerEl.focus(), 100);

		// Resize updates
		this.observeResize(this.container, () => this.calendar?.updateSize());

		// Settings subscription
		const settingsSubscription = this.bundle.settingsStore.settings$.subscribe((settings: SingleCalendarConfig) => {
			this.updateCalendarSettings(settings);
		});
		this.register(() => settingsSubscription.unsubscribe());

		// Subscribe to CalDAV settings changes (for integration event color)
		const caldavSettingsSubscription = this.bundle.settingsStore.mainSettingsStore.settings$.subscribe(() => {
			this.refreshEvents();
		});
		this.register(() => caldavSettingsSubscription.unsubscribe());

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
		void this.batchSelectionManager?.executeSkip();
	}

	markAsDoneSelection(): void {
		void this.batchSelectionManager?.executeMarkAsDone();
	}

	markAsNotDoneSelection(): void {
		void this.batchSelectionManager?.executeMarkAsNotDone();
	}

	duplicateSelection(): void {
		void this.batchSelectionManager?.executeDuplicate();
	}

	cloneSelection(weeks: number): void {
		void this.batchSelectionManager?.executeClone(weeks);
	}

	moveSelection(weeks: number): void {
		void this.batchSelectionManager?.executeMove(weeks);
	}

	deleteSelection(): void {
		void this.batchSelectionManager?.executeDelete();
	}

	openSelection(): void {
		void this.batchSelectionManager?.executeOpenAll();
	}

	moveBySelection(): void {
		this.batchSelectionManager?.executeMoveBy();
	}

	openFilterPresetSelector(): void {
		this.filterPresetSelector.open();
	}

	toggleUntrackedEventsDropdown(): void {
		this.untrackedEventsDropdown?.toggle();
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

	private setupDragEdgeScrolling(): void {
		if (!this.calendar || !this.container) return;

		const viewType = this.calendar.view.type;
		if (viewType === "dayGridMonth" || viewType === "listWeek") {
			return;
		}

		const EDGE_THRESHOLD = 50;
		const scrollDelay = this.bundle.settingsStore.currentSettings.dragEdgeScrollDelayMs;

		this.dragEdgeScrollListener = (e: MouseEvent) => {
			if (!this.calendar || !this.container) return;

			const rect = this.container.getBoundingClientRect();
			const mouseX = e.clientX;
			const leftEdge = rect.left;
			const rightEdge = rect.right;

			const now = Date.now();
			if (now - this.lastEdgeScrollTime < scrollDelay) {
				return;
			}

			if (mouseX < leftEdge + EDGE_THRESHOLD) {
				this.lastEdgeScrollTime = now;
				this.calendar.prev();
			} else if (mouseX > rightEdge - EDGE_THRESHOLD) {
				this.lastEdgeScrollTime = now;
				this.calendar.next();
			}
		};

		document.addEventListener("mousemove", this.dragEdgeScrollListener);
	}

	private cleanupDragEdgeScrolling(): void {
		if (this.dragEdgeScrollListener) {
			document.removeEventListener("mousemove", this.dragEdgeScrollListener);
			this.dragEdgeScrollListener = null;
		}
		if (this.dragEdgeScrollTimeout) {
			clearTimeout(this.dragEdgeScrollTimeout);
			this.dragEdgeScrollTimeout = null;
		}
		this.lastEdgeScrollTime = 0;
	}

	unmount(): Promise<void> {
		this.saveCurrentState();

		// Stop upcoming event check interval
		this.stopUpcomingEventCheck();

		// Cleanup drag edge scrolling
		this.cleanupDragEdgeScrolling();

		this.zoomManager.destroy();
		this.searchFilter.destroy();
		this.expressionFilter.destroy();
		this.untrackedEventsDropdown?.destroy();

		// Cancel any pending refresh
		if (this.refreshRafId !== null) {
			cancelAnimationFrame(this.refreshRafId);
			this.refreshRafId = null;
		}

		this.calendar?.destroy();
		this.calendar = null;

		this.colorEvaluator.destroy();
		this.batchSelectionManager = null;

		return Promise.resolve();
	}
}
