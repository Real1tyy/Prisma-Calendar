import { Calendar, type EventInput } from "@fullcalendar/core";
import allLocales from "@fullcalendar/core/locales-all";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { cls, ColorEvaluator, formatDuration } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { resolveEventColor } from "../../utils/event-color";
import { cleanupTitle } from "../../utils/event-naming";
import { toLocalISOString } from "../../utils/format";
import { emitHover } from "../../utils/obsidian";

export interface DailyCalendarHandle {
	calendar: Calendar;
	destroy: () => void;
	getDate: () => Date;
}

export interface DailyCalendarConfig {
	onDateChange?: (date: Date) => void;
}

/**
 * Creates a simplified FullCalendar instance locked to timeGridDay view.
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

	const settings = bundle.settingsStore.currentSettings;

	const calendar = new Calendar(container, {
		plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
		locales: allLocales,
		locale: settings.locale,
		timeZone: "local",
		initialView: "timeGridDay",
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

		headerToolbar: {
			left: "prev,next today",
			center: "title",
			right: "",
		},

		slotMinTime: `${String(settings.hourStart).padStart(2, "0")}:00:00`,
		slotMaxTime: `${String(settings.hourEnd).padStart(2, "0")}:00:00`,
		slotDuration: formatDuration(settings.slotDurationMinutes),
		snapDuration: formatDuration(settings.snapDurationMinutes),

		weekends: !settings.hideWeekends,
		firstDay: settings.firstDayOfWeek,

		eventOverlap: settings.eventOverlap,
		slotEventOverlap: settings.slotEventOverlap,

		editable: false,
		selectable: false,

		eventContent: (arg) => {
			const title = cleanupTitle(arg.event.title);
			const domNodes = document.createElement("div");
			domNodes.classList.add(cls("fc-event-content"));

			const titleSpan = document.createElement("span");
			titleSpan.classList.add(cls("fc-event-title"));
			titleSpan.textContent = title;
			domNodes.appendChild(titleSpan);

			if (arg.timeText) {
				const timeSpan = document.createElement("span");
				timeSpan.classList.add(cls("fc-event-time"));
				timeSpan.textContent = arg.timeText;
				domNodes.appendChild(timeSpan);
			}

			return { domNodes };
		},

		eventDidMount: (info) => {
			if (info.event.extendedProps.isVirtual) {
				info.el.classList.add(cls("virtual-event-opacity"), cls("virtual-event-cursor"));
				const isHoliday = info.event.extendedProps.filePath?.startsWith("holiday:");
				info.el.title = isHoliday ? "Holiday (read-only)" : "Virtual recurring event (read-only)";
				if (isHoliday) {
					info.el.classList.add(cls("holiday-event"));
				}
			}

			if (!info.event.extendedProps.isVirtual) {
				const filePath = info.event.extendedProps.filePath as string | undefined;
				if (filePath) {
					info.el.addEventListener("mouseenter", (e) => {
						if (settings.enableEventPreview) {
							emitHover(app, container, info.el, e, filePath, bundle.calendarId);
						}
					});
				}
			}
		},

		eventClick: (info) => {
			const filePath = info.event.extendedProps?.filePath;
			if (filePath && !info.event.extendedProps.isVirtual) {
				void app.workspace.openLinkText(filePath, "", false);
			}
		},

		datesSet: () => {
			config?.onDateChange?.(calendar.getDate());
			scheduleRefresh();
		},

		height: "auto",
		aspectRatio: 1.35,
	});

	function scheduleRefresh(): void {
		if (refreshRafId !== null) return;
		refreshRafId = requestAnimationFrame(async () => {
			refreshRafId = null;
			await refreshEvents();
		});
	}

	async function refreshEvents(): Promise<void> {
		if (!isIndexingComplete || !calendar.view || isRefreshing) return;
		isRefreshing = true;
		try {
			const { activeStart, activeEnd } = calendar.view;
			const start = toLocalISOString(activeStart);
			const end = toLocalISOString(activeEnd);

			const events = await bundle.eventStore.getEvents({ start, end });
			const mapped = events.map((event) => buildEvent(event));

			calendar.removeAllEvents();
			for (const ev of mapped) {
				calendar.addEvent(ev);
			}
		} finally {
			isRefreshing = false;
		}
	}

	function buildEvent(event: CalendarEvent): EventInput {
		const eventColor = resolveEventColor(event.meta, bundle, colorEvaluator);
		const start = event.start.replace(/Z$/, "");
		const end = isTimedEvent(event) ? event.end.replace(/Z$/, "") : undefined;

		return {
			id: event.ref.filePath,
			title: event.title,
			start,
			end,
			allDay: event.type === "allDay",
			color: eventColor,
			extendedProps: {
				filePath: event.ref.filePath,
				isVirtual: event.isVirtual ?? false,
			},
		};
	}

	calendar.render();

	const indexingSub = bundle.indexer.indexingComplete$.subscribe((complete) => {
		isIndexingComplete = complete;
		if (complete) scheduleRefresh();
	});
	subscriptions.push(indexingSub);

	const eventStoreSub = bundle.eventStore.subscribe(() => scheduleRefresh());
	subscriptions.push(eventStoreSub);

	const settingsSub = bundle.settingsStore.settings$.subscribe((s: SingleCalendarConfig) => {
		calendar.setOption("locale", s.locale);
		calendar.setOption("weekends", !s.hideWeekends);
		calendar.setOption("firstDay", s.firstDayOfWeek);
		calendar.setOption("nowIndicator", s.nowIndicator);
		calendar.setOption("slotMinTime", `${String(s.hourStart).padStart(2, "0")}:00:00`);
		calendar.setOption("slotMaxTime", `${String(s.hourEnd).padStart(2, "0")}:00:00`);
		calendar.setOption("slotDuration", formatDuration(s.slotDurationMinutes));
		calendar.setOption("snapDuration", formatDuration(s.snapDurationMinutes));
	});
	subscriptions.push(settingsSub);

	return {
		calendar,
		getDate: () => calendar.getDate(),
		destroy: () => {
			if (refreshRafId !== null) {
				cancelAnimationFrame(refreshRafId);
				refreshRafId = null;
			}
			for (const sub of subscriptions) sub.unsubscribe();
			subscriptions.length = 0;
			colorEvaluator.destroy();
			calendar.destroy();
		},
	};
}
