import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ColorEvaluator, toLocalISOString } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { UpdateEventCommand } from "../../core/commands";
import type { CalendarEventData, EventUpdateInfo, PrismaEventInput } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import type { CalendarHost } from "../calendar-host";
import { EventContextMenu } from "../event-context-menu";
import { SearchFilterInputManager } from "../input-managers/search-filter";
import { EventCreateModal, showEventPreviewModal } from "../modals";
import {
	applyContainerStyles,
	buildCalendarIconCache,
	buildCoreCalendarOptions,
	buildSharedEventClassNames,
	buildSharedEventContent,
	buildSharedEventDidMount,
	mapEventToPrismaInput,
	type SharedCalendarDeps,
	syncCalendarSettings,
} from "./shared-calendar-options";

export interface DailyCalendarHandle {
	calendar: Calendar;
	destroy: () => void;
	getDate: () => Date;
	prev: () => void;
	next: () => void;
}

export interface DailyCalendarConfig {
	onDateChange?: (date: Date) => void;
}

const CLICK_THRESHOLD_MS = 150;

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
	};

	const searchFilter = new SearchFilterInputManager(() => scheduleRefresh());

	const deps: SharedCalendarDeps = {
		app,
		bundle,
		container,
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

	const calendar = new Calendar(container, {
		...coreOptions,
		plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
		initialView: "timeGridDay",

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

		fixedMirrorParent: document.body,

		eventAllow: (_dropInfo, draggedEvent) => {
			return !draggedEvent?.extendedProps["isVirtual"];
		},

		eventContent: (arg) => eventContentCallback(arg),

		eventClassNames: (arg) => eventClassNamesCallback(arg),

		eventDidMount: (info) => {
			eventDidMountCallback(info);
		},

		eventClick: (info) => {
			handleEventClick(info.event, info.el);
		},

		eventMouseEnter: () => {},

		eventDrop: (info) => {
			void handleEventUpdate(extractEventUpdateInfo(info), "Error updating event dates:");
		},

		eventResize: (info) => {
			void handleEventUpdate(extractEventUpdateInfo(info), "Error updating event duration:");
		},

		dateClick: (info) => {
			if (!isHandlingSelection) {
				handleDateClick(info);
			}
			setTimeout(() => {
				isHandlingSelection = false;
			}, 50);
		},

		select: (info) => {
			const now = Date.now();
			const timeSinceMouseDown = now - mouseDownTime;
			if (timeSinceMouseDown < CLICK_THRESHOLD_MS) {
				calendar.unselect();
			} else {
				isHandlingSelection = true;
				handleDateSelection(info);
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

	searchFilter.initialize(calendar, container);

	// Mouse tracking for click-vs-drag detection
	container.addEventListener("mousedown", () => {
		mouseDownTime = Date.now();
	});

	applyContainerStyles(container, settings);

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
		if (!isIndexingComplete || !calendar.view) {
			releaseRefreshLock();
			return;
		}

		try {
			const { activeStart, activeEnd } = calendar.view;
			const start = toLocalISOString(activeStart);
			const end = toLocalISOString(activeEnd);

			const events = await bundle.eventStore.getEvents({ start, end });
			const visibleEvents: PrismaEventInput[] = events
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

	// ─── Event Interaction ───────────────────────────────────────

	function handleEventClick(
		event: Pick<CalendarEventData, "title" | "extendedProps" | "start" | "end" | "allDay">,
		_eventEl: HTMLElement
	): void {
		const filePath = event.extendedProps.filePath;
		const isVirtual = event.extendedProps.isVirtual;
		const isHoliday = typeof filePath === "string" && filePath.startsWith("holiday:");

		if (isHoliday) return;

		if (isVirtual && filePath && typeof filePath === "string") {
			showEventPreviewModal(app, bundle, {
				title: event.title,
				start: null,
				end: null,
				allDay: false,
				extendedProps: {
					filePath,
					frontmatterDisplayData: event.extendedProps.frontmatterDisplayData,
				},
			});
			return;
		}

		if (filePath && typeof filePath === "string") {
			void app.workspace.openLinkText(filePath, "", false);
		}
	}

	function handleDateClick(info: { date: Date; allDay: boolean }): void {
		const currentSettings = bundle.settingsStore.currentSettings;
		const endDate = new Date(info.date);
		endDate.setMinutes(endDate.getMinutes() + currentSettings.defaultDurationMinutes);

		new EventCreateModal(app, bundle, {
			title: "",
			start: toLocalISOString(info.date),
			end: info.allDay ? null : toLocalISOString(endDate),
			allDay: info.allDay,
			extendedProps: { filePath: null as string | null },
		}).open();
		calendar.unselect();
	}

	function handleDateSelection(info: { start: Date; end: Date; allDay: boolean }): void {
		new EventCreateModal(app, bundle, {
			title: "",
			start: toLocalISOString(info.start),
			end: toLocalISOString(info.end),
			allDay: info.allDay,
			extendedProps: { filePath: null as string | null },
		}).open();
		calendar.unselect();
	}

	function extractEventUpdateInfo(info: {
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

	async function handleEventUpdate(info: EventUpdateInfo | null, errorMessage: string): Promise<void> {
		if (!info) return;

		if (info.event.extendedProps.isVirtual === true) {
			info.revert();
			return;
		}

		const filePath = info.event.extendedProps.filePath;
		if (!filePath || typeof filePath !== "string") {
			info.revert();
			return;
		}

		try {
			const command = new UpdateEventCommand(
				app,
				bundle,
				filePath,
				toLocalISOString(info.event.start),
				info.event.end ? toLocalISOString(info.event.end) : undefined,
				info.event.allDay || false,
				toLocalISOString(info.oldEvent.start),
				info.oldEvent.end ? toLocalISOString(info.oldEvent.end) : undefined,
				info.oldEvent.allDay || false
			);
			await bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error(`[DailyCalendar] ${errorMessage}`, error);
			info.revert();
		}
	}

	// ─── Subscriptions ───────────────────────────────────────────

	const indexingSub = bundle.indexer.indexingComplete$.subscribe((complete) => {
		isIndexingComplete = complete;
		if (complete) scheduleRefresh();
	});
	subscriptions.push(indexingSub);

	const eventStoreSub = bundle.eventStore.subscribe(() => scheduleRefresh());
	subscriptions.push(eventStoreSub);

	const recurringEventSub = bundle.recurringEventManager.subscribe(() => scheduleRefresh());
	subscriptions.push(recurringEventSub);

	const settingsSub = bundle.settingsStore.settings$.subscribe((s: SingleCalendarConfig) => {
		syncCalendarSettings(calendar, s);
		applyContainerStyles(container, s);
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
