import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { cls, ColorEvaluator, toLocalISOString } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { merge, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { FCPrismaEventInput } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { isFileBackedEvent } from "../../utils/event-classification";
import { parseFCExtendedProps } from "../../utils/extended-props";
import type { CalendarHost } from "../calendar-host";
import { EventContextMenu } from "../event-context-menu";
import { SearchFilterInputManager } from "../input-managers/search-filter";
import {
	applyContainerStyles,
	buildCalendarIconCache,
	buildCoreCalendarOptions,
	buildSharedEventClassNames,
	buildSharedEventContent,
	buildSharedEventDidMount,
	CLICK_THRESHOLD_MS,
	extractSharedEventUpdateInfo,
	handleSharedDateClick,
	handleSharedDateSelection,
	handleSharedEventClick,
	handleSharedEventUpdate,
	mapEventToPrismaInput,
	SELECTION_GUARD_DELAY_MS,
	type SharedCalendarDeps,
	syncCalendarSettings,
} from "./shared-calendar-options";

export interface DailyDragCapture {
	filePath: string;
	oldStart: Date;
	oldEnd: Date | null;
	allDay: boolean;
}

/**
 * Shared state that lets sibling daily-calendar instances (e.g. the two panes
 * of Dual Daily) coordinate a cross-calendar drag. The source pane writes the
 * original event datetime here on drag start; the destination pane reads it in
 * eventReceive to build the update command.
 */
export interface DailyDragState {
	current: DailyDragCapture | null;
}

export interface DailyCalendarHandle {
	calendar: Calendar;
	destroy: () => void;
	getDate: () => Date;
	prev: () => void;
	next: () => void;
}

export type EmbeddedCalendarView = "timeGridDay" | "dayGridMonth";

export interface DailyCalendarConfig {
	onDateChange?: (date: Date) => void;
	sharedDragState?: DailyDragState;
	/** FullCalendar view to lock the embedded calendar into. Defaults to `timeGridDay`. */
	initialView?: EmbeddedCalendarView;
}

/**
 * Creates a FullCalendar instance locked to timeGridDay view that reuses
 * the full CalendarComponent rendering and interaction model.
 * Used by Daily+Stats and Dual Daily tabs.
 */
export function createDailyCalendar(
	container: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	config?: DailyCalendarConfig
): DailyCalendarHandle {
	const calendarContainer = container.createDiv({ cls: cls("calendar-container") });
	const colorEvaluator = new ColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);
	const subscriptions: Subscription[] = [];
	let isIndexingComplete = false;
	let refreshRafId: number | null = null;
	let isRefreshing = false;
	let pendingRefreshRequest = false;
	let calendarIconCache = buildCalendarIconCache(bundle);
	let mouseDownTime = 0;
	let isHandlingSelection = false;
	let cachedNow = new Date();
	let cachedTodayStart = new Date(cachedNow.getFullYear(), cachedNow.getMonth(), cachedNow.getDate());

	const calendarHost: CalendarHost = {
		navigateToDate: (date) => calendar.gotoDate(date),
		highlightEventByPath: () => {},
		enterPrerequisiteSelectionMode: () => {},
	};

	const searchFilter = new SearchFilterInputManager(() => scheduleRefresh());

	const deps: SharedCalendarDeps = {
		app,
		bundle,
		container: calendarContainer,
		colorEvaluator,
		calendarHost,
		getCalendarIconCache: () => calendarIconCache,
	};

	const eventContextMenu = new EventContextMenu(app, bundle, calendarHost);

	const eventContentCallback = buildSharedEventContent(deps);
	const eventClassNamesCallback = buildSharedEventClassNames(deps, () => ({
		now: cachedNow,
		todayStart: cachedTodayStart,
	}));

	const settings = bundle.settingsStore.currentSettings;
	const coreOptions = buildCoreCalendarOptions(settings);

	const calendar = new Calendar(calendarContainer, {
		...coreOptions,
		plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
		initialView: config?.initialView ?? "timeGridDay",

		headerToolbar: {
			left: "prev,next today",
			center: "title",
			right: "",
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

		fixedMirrorParent: document.body,

		eventAllow: (_dropInfo, draggedEvent) => {
			return draggedEvent ? isFileBackedEvent(draggedEvent) : false;
		},

		eventDragStart: (info) => {
			const state = config?.sharedDragState;
			if (!state) return;
			if (!info.event.start || !isFileBackedEvent(info.event)) {
				state.current = null;
				return;
			}
			state.current = {
				filePath: parseFCExtendedProps(info.event).filePath,
				oldStart: info.event.start,
				oldEnd: info.event.end,
				allDay: info.event.allDay,
			};
		},

		eventReceive: (info) => {
			const state = config?.sharedDragState;
			const capture = state?.current ?? null;
			if (state) state.current = null;

			// Drop the ghost event: the event store will re-add the real event
			// at its new datetime once the file write propagates.
			info.event.remove();

			if (!capture) return;

			const updateInfo = extractSharedEventUpdateInfo({
				event: {
					title: info.event.title,
					start: info.event.start,
					end: info.event.end,
					allDay: info.event.allDay,
					extendedProps: { ...info.event.extendedProps, filePath: capture.filePath },
				},
				oldEvent: { start: capture.oldStart, end: capture.oldEnd, allDay: capture.allDay },
				revert: () => {},
			});
			void handleSharedEventUpdate(app, bundle, updateInfo, "Error moving event across panes:", "DailyCalendar");
		},

		eventContent: (arg) => eventContentCallback(arg),

		eventClassNames: (arg) => eventClassNamesCallback(arg),

		eventDidMount: (info) => {
			eventDidMountCallback(info);
		},

		eventClick: (info) => {
			handleSharedEventClick(app, bundle, info.event);
		},

		eventMouseEnter: () => {},

		eventDrop: (info) => {
			void handleSharedEventUpdate(
				app,
				bundle,
				extractSharedEventUpdateInfo(info),
				"Error updating event dates:",
				"DailyCalendar"
			);
		},

		eventResize: (info) => {
			void handleSharedEventUpdate(
				app,
				bundle,
				extractSharedEventUpdateInfo(info),
				"Error updating event duration:",
				"DailyCalendar"
			);
		},

		dateClick: (info) => {
			if (!isHandlingSelection) {
				handleSharedDateClick(app, bundle, calendar, info);
			}
			setTimeout(() => {
				isHandlingSelection = false;
			}, SELECTION_GUARD_DELAY_MS);
		},

		select: (info) => {
			const now = Date.now();
			const timeSinceMouseDown = now - mouseDownTime;
			if (timeSinceMouseDown < CLICK_THRESHOLD_MS) {
				calendar.unselect();
			} else {
				isHandlingSelection = true;
				handleSharedDateSelection(app, bundle, calendar, info);
			}
		},

		datesSet: () => {
			cachedNow = new Date();
			cachedTodayStart = new Date(cachedNow.getFullYear(), cachedNow.getMonth(), cachedNow.getDate());
			config?.onDateChange?.(calendar.getDate());
			scheduleRefresh();
		},

		height: "100%",
	});

	const eventDidMountCallback = buildSharedEventDidMount(deps, eventContextMenu, () => null);

	calendar.render();

	searchFilter.initialize(calendar, calendarContainer);

	calendarContainer.addEventListener("mousedown", () => {
		mouseDownTime = Date.now();
	});

	applyContainerStyles(calendarContainer, settings);

	const resizeObserver = new ResizeObserver(() => {
		calendar.updateSize();
	});
	resizeObserver.observe(container);

	// ─── Event Refresh ───────────────────────────────────────────

	function scheduleRefresh(): void {
		if (isRefreshing) {
			pendingRefreshRequest = true;
			return;
		}
		if (refreshRafId !== null) return;

		refreshRafId = requestAnimationFrame(() => {
			refreshRafId = null;
			isRefreshing = true;
			pendingRefreshRequest = false;
			void refreshEvents();
		});
	}

	function releaseRefreshLock(): void {
		isRefreshing = false;
		if (pendingRefreshRequest) {
			pendingRefreshRequest = false;
			scheduleRefresh();
		}
	}

	async function refreshEvents(): Promise<void> {
		if (!isIndexingComplete) {
			releaseRefreshLock();
			return;
		}

		try {
			const { activeStart, activeEnd } = calendar.view;
			const start = toLocalISOString(activeStart);
			const end = toLocalISOString(activeEnd);

			const events = await bundle.eventStore.getEvents({ start, end });
			const visibleEvents: FCPrismaEventInput[] = events
				.filter((event) => searchFilter.shouldInclude({ meta: event.meta, title: event.title }))
				.map((event) => mapEventToPrismaInput(event, bundle, colorEvaluator));

			calendar.removeAllEvents();
			calendar.batchRendering(() => {
				for (const ev of visibleEvents) {
					calendar.addEvent(ev);
				}
			});
		} catch (error) {
			console.error("[DailyCalendar] Error refreshing events:", error);
		}

		releaseRefreshLock();
	}

	// ─── Subscriptions ───────────────────────────────────────────

	const indexingSub = bundle.fileRepository.indexingComplete$.subscribe((complete) => {
		isIndexingComplete = complete;
		if (complete) scheduleRefresh();
	});
	subscriptions.push(indexingSub);

	const storeSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$).subscribe(() =>
		scheduleRefresh()
	);
	subscriptions.push(storeSub);

	const settingsSub = bundle.settingsStore.settings$.subscribe((s: SingleCalendarConfig) => {
		syncCalendarSettings(calendar, s);
		applyContainerStyles(calendarContainer, s);
	});
	subscriptions.push(settingsSub);

	const mainSettingsSub = bundle.settingsStore.mainSettingsStore.settings$.subscribe(() => {
		calendarIconCache = buildCalendarIconCache(bundle);
	});
	subscriptions.push(mainSettingsSub);

	return {
		calendar,
		getDate: () => calendar.getDate(),
		prev: () => calendar.prev(),
		next: () => calendar.next(),
		destroy: () => {
			resizeObserver.disconnect();
			if (refreshRafId !== null) {
				cancelAnimationFrame(refreshRafId);
				refreshRafId = null;
			}
			for (const sub of subscriptions) sub.unsubscribe();
			subscriptions.length = 0;
			searchFilter.destroy();
			colorEvaluator.destroy();
			calendar.destroy();
		},
	};
}
