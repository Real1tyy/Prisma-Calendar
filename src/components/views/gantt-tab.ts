import {
	addCls,
	cls,
	ColorEvaluator,
	removeCls,
	type TabDefinition,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import Gantt, { type Task } from "frappe-gantt";
import frappeGanttCss from "frappe-gantt/dist/frappe-gantt.css";
import type { App } from "obsidian";
import { debounceTime, distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { DependencyGraph } from "../../core/dependency-graph";
import { PRO_FEATURES } from "../../core/license";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { resolveEventColor } from "../../utils/event-color";
import { showEventPreviewModal } from "../modals";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";

const REFRESH_DEBOUNCE_MS = 100;
const GANTT_STYLE_ID = "prisma-gantt-vendor-css";
const FALLBACK_HEIGHT = 500;

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
	tracker: CalendarBundle["prerequisiteTracker"],
	bundle: CalendarBundle,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): Task[] {
	return events
		.filter((event) => tracker.isConnected(event.ref.filePath))
		.map((event) => {
			const { start, end } = getTaskDates(event);
			const prereqs = graph.get(event.ref.filePath) ?? [];
			const dependencies = prereqs.map(sanitizeGanttId);
			const color = resolveEventColor(event.meta ?? {}, bundle, colorEvaluator);

			const task: Task = {
				id: sanitizeGanttId(event.ref.filePath),
				name: event.title,
				start,
				end,
				progress: 0,
				color,
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

// ─── Row Packing ────────────────────────────────────────────

interface InternalTask {
	id: string;
	name: string;
	_start: Date;
	_end: Date;
	_index: number;
	_arrayIndex: number;
	dependencies: string[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * Replaces SVG `<text class="bar-label">` elements with `<foreignObject>` +
 * word-wrapping HTML so that long titles wrap inside the bar instead of
 * overflowing to the right.
 */
function wrapBarLabels(container: HTMLElement): void {
	const labels = Array.from(container.querySelectorAll(".bar-label")) as SVGTextElement[];
	for (const label of labels) {
		const barGroup = label.closest(".bar-wrapper");
		if (!barGroup) continue;

		const bar = barGroup.querySelector(".bar") as SVGRectElement | null;
		if (!bar) continue;

		const barX = parseFloat(bar.getAttribute("x") ?? "0");
		const barY = parseFloat(bar.getAttribute("y") ?? "0");
		const barW = parseFloat(bar.getAttribute("width") ?? "0");
		const barH = parseFloat(bar.getAttribute("height") ?? "0");

		const fo = document.createElementNS(SVG_NS, "foreignObject");
		fo.setAttribute("x", String(barX));
		fo.setAttribute("y", String(barY));
		fo.setAttribute("width", String(barW));
		fo.setAttribute("height", String(barH));
		fo.classList.add("bar-label-fo");

		const div = document.createElementNS(XHTML_NS, "div") as HTMLDivElement;
		div.classList.add("prisma-gantt-bar-label");
		div.textContent = label.textContent;
		fo.appendChild(div);

		label.replaceWith(fo);
	}
}

/**
 * Greedy bin-packing: assigns `_index` (row) so that independent
 * chains share rows when their time ranges don't overlap visually.
 * Tasks with dependency relationships are forced onto separate rows
 * (dependent always on a higher row than its prerequisite).
 */
export function packGanttRows(tasks: InternalTask[]): number {
	if (tasks.length === 0) return 0;

	const sorted = [...tasks].sort((a, b) => +a._start - +b._start);
	const taskRowMap = new Map<string, number>();
	const rowEndTimes: number[] = [];

	for (const task of sorted) {
		let minRow = 0;
		for (const depId of task.dependencies) {
			const depRow = taskRowMap.get(depId);
			if (depRow !== undefined) {
				minRow = Math.max(minRow, depRow + 1);
			}
		}

		const vEnd = +task._end;

		let placed = false;
		for (let r = minRow; r < rowEndTimes.length; r++) {
			if (+task._start >= rowEndTimes[r]) {
				task._index = r;
				taskRowMap.set(task.id, r);
				rowEndTimes[r] = vEnd;
				placed = true;
				break;
			}
		}

		if (!placed) {
			task._index = rowEndTimes.length;
			taskRowMap.set(task.id, rowEndTimes.length);
			rowEndTimes.push(vEnd);
		}
	}

	return rowEndTimes.length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGantt = any;

/**
 * Patches a frappe-gantt instance so that:
 *  1. `setup_tasks` applies row packing after default index assignment
 *  2. `make_arrows` looks up bars by `_arrayIndex` (array position)
 *     instead of `_index` (which is now the packed row)
 *  3. `make_grid_background` uses the packed row count for grid height
 */
function patchGanttInstance(ganttInst: AnyGantt): void {
	let ArrowCtor: AnyGantt = null;
	if (ganttInst.arrows?.length > 0) {
		ArrowCtor = ganttInst.arrows[0].constructor;
	}

	const origSetupTasks = ganttInst.setup_tasks.bind(ganttInst);
	ganttInst.setup_tasks = function (tasks: AnyGantt[]) {
		origSetupTasks(tasks);

		for (let i = 0; i < this.tasks.length; i++) {
			this.tasks[i]._arrayIndex = i;
		}
		this._packedRowCount = packGanttRows(this.tasks);

		if (!ArrowCtor && this.arrows?.length > 0) {
			ArrowCtor = this.arrows[0].constructor;
		}
	};

	const origMakeGridBg = ganttInst.make_grid_background.bind(ganttInst);
	ganttInst.make_grid_background = function (this: AnyGantt) {
		origMakeGridBg();

		const count: number = this._packedRowCount ?? this.tasks.length;
		const rowH: number = this.options.bar_height + this.options.padding;
		const contentH = this.config.header_height + this.options.padding + rowH * count - 10;
		const minH = typeof this.options.container_height === "number" ? this.options.container_height : 0;
		const h = Math.max(contentH, minH);

		this.grid_height = h;
		const bg = this.$svg.querySelector(".grid-background");
		if (bg) bg.setAttribute("height", String(h));
		this.$svg.setAttribute("height", String(h));
		this.$container.style.height = h + "px";
	};

	ganttInst.make_arrows = function (this: AnyGantt) {
		this.arrows = [];
		for (const task of this.tasks) {
			const arrows = (task.dependencies as string[])
				.map((taskId: string) => {
					const dependency = this.get_task(taskId);
					if (!dependency) return null;
					const fromBar = this.bars[dependency._arrayIndex];
					const toBar = this.bars[task._arrayIndex];
					if (!fromBar || !toBar || !ArrowCtor) return null;
					const arrow = new ArrowCtor(this, fromBar, toBar);
					this.layers.arrow.appendChild(arrow.element);
					return arrow;
				})
				.filter(Boolean);
			this.arrows = this.arrows.concat(arrows);
		}
	};
}

// ─── Tab Definition ─────────────────────────────────────────

export function createGanttTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let gantt: Gantt | null = null;
	let mergedSub: Subscription | null = null;
	let isProSub: Subscription | null = null;
	let wrapperEl: HTMLElement | null = null;
	let emptyEl: HTMLElement | null = null;
	let eventsSnapshot: CalendarEvent[] = [];
	let colorEvaluator: ColorEvaluator<SingleCalendarConfig> | null = null;

	function enableDragToPan(container: HTMLElement): void {
		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let scrollLeft = 0;
		let scrollTop = 0;

		container.addEventListener("mousedown", (e) => {
			const target = e.target as HTMLElement;
			if (target.closest(".bar-wrapper, .handle, .today-button, .viewmode-select")) return;
			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;
			scrollLeft = container.scrollLeft;
			scrollTop = container.scrollTop;
			container.style.cursor = "grabbing";
			e.preventDefault();
		});

		document.addEventListener("mousemove", (e) => {
			if (!isDragging) return;
			container.scrollLeft = scrollLeft - (e.clientX - startX);
			container.scrollTop = scrollTop - (e.clientY - startY);
		});

		document.addEventListener("mouseup", () => {
			if (!isDragging) return;
			isDragging = false;
			container.style.cursor = "";
		});
	}

	function initGantt(tasks: Task[], containerHeight: number): void {
		if (!wrapperEl) return;
		wrapperEl.empty();

		gantt = new Gantt(wrapperEl, tasks, {
			view_mode: "Day",
			readonly: true,
			readonly_dates: true,
			readonly_progress: true,
			today_button: true,
			scroll_to: "today",
			container_height: containerHeight,
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

		patchGanttInstance(gantt);

		const g = gantt as AnyGantt;
		for (let i = 0; i < g.tasks.length; i++) {
			g.tasks[i]._arrayIndex = i;
		}
		g._packedRowCount = packGanttRows(g.tasks);
		g.change_view_mode();
		requestAnimationFrame(() => wrapBarLabels(wrapperEl!));

		enableDragToPan(g.$container);
	}

	function rebuild(el: HTMLElement): void {
		eventsSnapshot = bundle.eventStore.getAllEvents();
		const graph = bundle.prerequisiteTracker.getGraph();
		if (!colorEvaluator) colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		const tasks = buildTasks(eventsSnapshot, graph, bundle.prerequisiteTracker, bundle, colorEvaluator);

		if (tasks.length === 0) {
			gantt = null;
			wrapperEl?.empty();
			if (emptyEl) removeCls(emptyEl, "hidden");
			return;
		}

		if (emptyEl) addCls(emptyEl, "hidden");

		if (gantt) {
			gantt.refresh(tasks);
			requestAnimationFrame(() => {
				if (wrapperEl) wrapBarLabels(wrapperEl);
			});
			return;
		}

		const containerHeight = el.clientHeight || FALLBACK_HEIGHT;
		initGantt(tasks, containerHeight);
	}

	function cleanupContent(): void {
		mergedSub?.unsubscribe();
		mergedSub = null;
		colorEvaluator?.destroy();
		colorEvaluator = null;
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
					cls: cls("gantt-empty", "hidden"),
					text: "No prerequisite connections found. Add prerequisites to events to see them here.",
				});
				wrapperEl = el.createDiv({ cls: cls("gantt-wrapper") });

				rebuild(el);

				mergedSub = merge(
					bundle.eventStore.changes$,
					bundle.recurringEventManager.changes$,
					bundle.prerequisiteTracker.graph$
				)
					.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
					.subscribe(() => {
						rebuild(el);
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
