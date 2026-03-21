import { addCls, cls, removeCls, type TabDefinition, toLocalISOString } from "@real1ty-obsidian-plugins";
import Gantt, { type Task } from "frappe-gantt";
import frappeGanttCss from "frappe-gantt/dist/frappe-gantt.css";
import type { App } from "obsidian";
import { debounceTime, distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { DependencyGraph } from "../../core/dependency-graph";
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
	const d = new Date(dateStr + "T12:00:00");
	d.setDate(d.getDate() + 1);
	return toLocalISOString(d).slice(0, 10);
}

function getTaskDates(event: CalendarEvent): { start: string; end: string } {
	const start = event.start.slice(0, 10);
	const rawEnd = event.type === "allDay" ? start : event.end.slice(0, 10);
	const end = rawEnd === start ? nextDay(start) : rawEnd;
	return { start, end };
}

function buildTasks(
	events: CalendarEvent[],
	graph: DependencyGraph,
	tracker: CalendarBundle["prerequisiteTracker"]
): Task[] {
	const tasks = events
		.filter((event) => tracker.isConnected(event.ref.filePath))
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

	return sortTasksByChain(tasks);
}

function sortTasksByChain(tasks: Task[]): Task[] {
	if (tasks.length === 0) return tasks;

	const taskById = new Map(tasks.map((t) => [t.id, t]));
	const adjacency = new Map<string, Set<string>>();
	for (const t of tasks) {
		if (!adjacency.has(t.id)) adjacency.set(t.id, new Set());
		for (const dep of t.dependencies ?? []) {
			if (!taskById.has(dep)) continue;
			if (!adjacency.has(dep)) adjacency.set(dep, new Set());
			adjacency.get(t.id)!.add(dep);
			adjacency.get(dep)!.add(t.id);
		}
	}

	const visited = new Set<string>();
	const components: Task[][] = [];

	for (const task of tasks) {
		if (visited.has(task.id)) continue;
		const component: Task[] = [];
		const queue = [task.id];
		while (queue.length > 0) {
			const id = queue.pop()!;
			if (visited.has(id)) continue;
			visited.add(id);
			const t = taskById.get(id);
			if (t) component.push(t);
			for (const neighbor of adjacency.get(id) ?? []) {
				if (!visited.has(neighbor)) queue.push(neighbor);
			}
		}
		component.sort((a, b) => a.start.localeCompare(b.start));
		components.push(component);
	}

	components.sort((a, b) => a[0].start.localeCompare(b[0].start));
	return components.flat();
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
	let wheelHandler: ((e: WheelEvent) => void) | null = null;

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
			infinite_padding: false,
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

		const container = wrapperEl.querySelector<HTMLElement>(".gantt-container");
		if (container) {
			wheelHandler = (e: WheelEvent) => {
				if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
					e.preventDefault();
					container.scrollLeft += e.deltaY;
				}
			};
			container.addEventListener("wheel", wheelHandler, { passive: false });
		}
	}

	function rebuild(): void {
		eventsSnapshot = bundle.eventStore.getAllEvents();
		const graph = bundle.prerequisiteTracker.getGraph();
		const tasks = buildTasks(eventsSnapshot, graph, bundle.prerequisiteTracker);

		if (tasks.length === 0) {
			gantt = null;
			wrapperEl?.empty();
			if (emptyEl) removeCls(emptyEl, "hidden");
			return;
		}

		if (emptyEl) addCls(emptyEl, "hidden");

		if (gantt) {
			gantt.refresh(tasks);
			return;
		}

		createGantt(tasks);
	}

	function cleanupContent(): void {
		mergedSub?.unsubscribe();
		mergedSub = null;
		if (wheelHandler && wrapperEl) {
			const container = wrapperEl.querySelector<HTMLElement>(".gantt-container");
			container?.removeEventListener("wheel", wheelHandler);
		}
		wheelHandler = null;
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

				mergedSub = merge(
					bundle.eventStore.changes$,
					bundle.recurringEventManager.changes$,
					bundle.prerequisiteTracker.graph$
				)
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
