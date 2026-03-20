import { cls, type TabDefinition } from "@real1ty-obsidian-plugins";
import Gantt, { type Task, type ViewMode } from "frappe-gantt";
import type { App } from "obsidian";
import { debounceTime, merge, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { buildDependencyGraph, isConnected } from "../../core/dependency-graph";
import { PRO_FEATURES } from "../../core/license";
import type { CalendarEvent } from "../../types/calendar";
import { showEventPreviewModal } from "../modals";

const REFRESH_DEBOUNCE_MS = 100;

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

function buildTasks(events: CalendarEvent[], graph: Map<string, string[]>, connectedOnly: boolean): Task[] {
	return events
		.filter((event) => !connectedOnly || isConnected(graph, event.ref.filePath))
		.map((event) => {
			const { start, end } = getTaskDates(event);
			const prereqs = graph.get(event.ref.filePath) ?? [];
			const dependencies = prereqs.map(sanitizeGanttId).join(",");

			const task: Task = {
				id: sanitizeGanttId(event.ref.filePath),
				name: event.title,
				start,
				end,
				progress: 0,
			};

			if (dependencies) {
				task.dependencies = dependencies;
			}

			return task;
		});
}

export function createGanttTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let gantt: Gantt | null = null;
	let mergedSub: Subscription | null = null;
	let connectedOnly = false;
	let currentViewMode: ViewMode = "Week";

	function rebuild(el: HTMLElement): void {
		const events = bundle.eventStore.getAllEvents();
		const settings = bundle.settingsStore.currentSettings;
		const { graph } = buildDependencyGraph(events, settings, app);
		const tasks = buildTasks(events, graph, connectedOnly);

		if (gantt) {
			gantt.refresh(tasks);
			return;
		}

		const wrapper = el.querySelector<HTMLElement>(`.${cls("gantt-wrapper")}`);
		if (!wrapper) return;

		gantt = new Gantt(wrapper, tasks, {
			view_mode: currentViewMode,
			custom_popup_html: null,
			on_click: (task: Task) => {
				const event = events.find((e) => sanitizeGanttId(e.ref.filePath) === task.id);
				if (!event) return;

				const start = new Date(event.start);
				const end = event.type === "timed" ? new Date(event.end) : null;

				showEventPreviewModal(app, bundle, {
					title: event.title,
					start,
					end,
					allDay: event.allDay,
					extendedProps: { filePath: event.ref.filePath },
				});
			},
		});
	}

	return {
		id: "gantt",
		label: "Gantt",
		render: (el) => {
			if (!bundle.plugin.licenseManager.requirePro(PRO_FEATURES.PREREQUISITE_CONNECTIONS)) {
				el.createDiv({ cls: cls("tab-pro-gate"), text: "Gantt view requires Prerequisite Connections (Pro)." });
				return;
			}

			const toolbar = el.createDiv({ cls: cls("gantt-toolbar") });

			const viewModes: ViewMode[] = ["Day", "Week", "Month", "Year"];
			for (const mode of viewModes) {
				const btn = toolbar.createEl("button", { text: mode, cls: cls("gantt-view-btn") });
				btn.addEventListener("click", () => {
					currentViewMode = mode;
					gantt?.change_view_mode(mode);
				});
			}

			const filterLabel = toolbar.createEl("label", { cls: cls("gantt-filter-label") });
			const filterCheckbox = filterLabel.createEl("input", { type: "checkbox" });
			filterLabel.createSpan({ text: "Connected only" });

			filterCheckbox.addEventListener("change", () => {
				connectedOnly = filterCheckbox.checked;
				gantt?.destroy();
				gantt = null;
				rebuild(el);
			});

			el.createDiv({ cls: cls("gantt-wrapper") });

			rebuild(el);

			mergedSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$)
				.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
				.subscribe(() => {
					rebuild(el);
				});
		},
		cleanup: () => {
			mergedSub?.unsubscribe();
			mergedSub = null;
			gantt?.destroy();
			gantt = null;
		},
	};
}
