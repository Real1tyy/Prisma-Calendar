import { cls, type TabDefinition } from "@real1ty-obsidian-plugins";
import Gantt, { type Task } from "frappe-gantt";
import frappeGanttCss from "frappe-gantt/dist/frappe-gantt.css";
import type { App } from "obsidian";
import { debounceTime, distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { buildDependencyGraph, isConnected } from "../../core/dependency-graph";
import { PRO_FEATURES } from "../../core/license";
import type { CalendarEvent } from "../../types/calendar";
import { showEventPreviewModal } from "../modals";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";

const REFRESH_DEBOUNCE_MS = 100;
const GANTT_STYLE_ID = "prisma-gantt-vendor-css";

export function sanitizeGanttId(filePath: string): string {
	return filePath.replace(/[^a-zA-Z0-9]/g, "_");
}

function nextDay(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	d.setDate(d.getDate() + 1);
	return d.toISOString().slice(0, 10);
}

function getTaskDates(event: CalendarEvent): { start: string; end: string } {
	const start = event.start.slice(0, 10);
	const rawEnd = event.type === "allDay" ? start : event.end.slice(0, 10);
	const end = rawEnd === start ? nextDay(start) : rawEnd;
	return { start, end };
}

function buildTasks(events: CalendarEvent[], graph: Map<string, string[]>): Task[] {
	return events
		.filter((event) => isConnected(graph, event.ref.filePath))
		.map((event) => {
			const { start, end } = getTaskDates(event);
			const prereqs = graph.get(event.ref.filePath) ?? [];
			const dependencies = prereqs.map(sanitizeGanttId);

			const task: Task = {
				id: sanitizeGanttId(event.ref.filePath),
				name: event.title,
				start,
				end,
				progress: 0,
			};

			if (dependencies.length > 0) {
				task.dependencies = dependencies;
			}

			return task;
		});
}

function injectVendorCss(): void {
	if (document.getElementById(GANTT_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = GANTT_STYLE_ID;
	style.textContent = frappeGanttCss;
	document.head.appendChild(style);
}

export function createGanttTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let gantt: Gantt | null = null;
	let mergedSub: Subscription | null = null;
	let isProSub: Subscription | null = null;
	let wrapperEl: HTMLElement | null = null;
	let emptyEl: HTMLElement | null = null;
	let eventsSnapshot: CalendarEvent[] = [];

	function createGantt(tasks: Task[]): void {
		if (!wrapperEl) return;
		wrapperEl.empty();

		gantt = new Gantt(wrapperEl, tasks, {
			view_mode: "Week",
			view_mode_select: true,
			view_modes: ["Day", "Week", "Month", "Year"],
			readonly: true,
			readonly_dates: true,
			readonly_progress: true,
			today_button: true,
			scroll_to: "today",
			container_height: "auto",
			popup: () => false,
			on_click: (task: Task) => {
				const event = eventsSnapshot.find((e) => sanitizeGanttId(e.ref.filePath) === task.id);
				if (!event) return;

				showEventPreviewModal(app, bundle, {
					title: event.title,
					start: new Date(event.start),
					end: event.type === "timed" ? new Date(event.end) : null,
					allDay: event.allDay,
					extendedProps: { filePath: event.ref.filePath },
				});
			},
		});
	}

	function rebuild(): void {
		eventsSnapshot = bundle.eventStore.getAllEvents();
		const settings = bundle.settingsStore.currentSettings;
		const { graph } = buildDependencyGraph(eventsSnapshot, settings, app);
		const tasks = buildTasks(eventsSnapshot, graph);

		if (tasks.length === 0) {
			gantt = null;
			wrapperEl?.empty();
			if (emptyEl) emptyEl.style.display = "";
			return;
		}

		if (emptyEl) emptyEl.style.display = "none";

		if (gantt) {
			gantt.refresh(tasks);
			return;
		}

		createGantt(tasks);
	}

	function cleanupContent(): void {
		mergedSub?.unsubscribe();
		mergedSub = null;
		gantt = null;
		wrapperEl = null;
		emptyEl = null;
	}

	return {
		id: "gantt",
		label: "Gantt",
		render: (el) => {
			function renderTab(): void {
				cleanupContent();
				el.empty();

				if (!bundle.plugin.licenseManager.isPro) {
					renderProUpgradeBanner(
						el,
						PRO_FEATURES.GANTT,
						"Define dependencies between events and visualize them in a Gantt chart. Track task order and project timelines.",
						"GANTT"
					);
					return;
				}

				injectVendorCss();

				emptyEl = el.createDiv({
					cls: cls("gantt-empty"),
					text: "No prerequisite connections found. Add prerequisites to events to see them here.",
				});
				wrapperEl = el.createDiv({ cls: cls("gantt-wrapper") });

				rebuild();

				mergedSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$)
					.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
					.subscribe(() => {
						rebuild();
					});
			}

			renderTab();

			isProSub = bundle.plugin.licenseManager.isPro$.pipe(skip(1), distinctUntilChanged()).subscribe(() => renderTab());
		},
		cleanup: () => {
			isProSub?.unsubscribe();
			isProSub = null;
			cleanupContent();
		},
	};
}
