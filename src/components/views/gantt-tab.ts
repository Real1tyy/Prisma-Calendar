import { cls, ColorEvaluator, parseIntoList, type TabDefinition } from "@real1ty-obsidian-plugins";
import { type App, Menu, setIcon } from "obsidian";
import { debounceTime, distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { assignPrerequisites } from "../../core/commands/frontmatter-update-command";
import { DeleteEventCommand } from "../../core/commands/lifecycle-commands";
import { PRO_FEATURES } from "../../core/license";
import type { BarLayout, GanttInteractionHooks, GanttRenderData, PackedTask, Viewport } from "../../gantt";
import {
	GANTT_DEFAULTS,
	GanttRenderer,
	layoutArrows,
	layoutBars,
	normalizeEvents,
	packRows,
	sanitizeGanttId,
} from "../../gantt";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { getFileAndFrontmatter } from "../../utils/obsidian";
import { showEventPreviewModal } from "../modals";
import { openPrerequisiteAssignModal } from "../modals/category/assignment";
import { EventCreateModal } from "../modals/event/event-create-modal";
import { EventEditModal } from "../modals/event/event-edit-modal";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";
import { createViewFilterBar, type ViewFilterBarHandle } from "../view-filter-bar";

const REFRESH_DEBOUNCE_MS = 100;

export { sanitizeGanttId };

export function createGanttTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let renderer: GanttRenderer | null = null;
	let mergedSub: Subscription | null = null;
	let isProSub: Subscription | null = null;
	let wrapperEl: HTMLElement | null = null;
	let eventsByPath = new Map<string, CalendarEvent>();
	let colorEvaluator: ColorEvaluator<SingleCalendarConfig> | null = null;
	let filterBar: ViewFilterBarHandle | null = null;

	let cachedPacked: PackedTask[] = [];
	let cachedTaskMap = new Map<string, PackedTask>();

	function findEventByTaskId(taskId: string): CalendarEvent | undefined {
		const task = cachedTaskMap.get(taskId);
		return task ? eventsByPath.get(task.filePath) : undefined;
	}

	function openPreview(event: CalendarEvent): void {
		showEventPreviewModal(app, bundle, {
			title: event.title,
			start: new Date(event.start),
			end: event.type === "timed" ? new Date(event.end) : null,
			allDay: event.allDay,
			extendedProps: { filePath: event.ref.filePath },
		});
	}

	function showBarContextMenu(taskId: string, e: MouseEvent): void {
		const event = findEventByTaskId(taskId);
		if (!event) return;
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle("Preview")
				.setIcon("eye")
				.onClick(() => openPreview(event))
		);
		menu.addItem((item) =>
			item
				.setTitle("Edit event")
				.setIcon("pencil")
				.onClick(() => {
					new EventEditModal(app, bundle, {
						title: event.title,
						start: event.start,
						end: event.type === "timed" ? event.end : null,
						allDay: event.allDay,
						extendedProps: { filePath: event.ref.filePath },
					}).open();
				})
		);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Assign prerequisites")
				.setIcon("link")
				.onClick(() => {
					const settings = bundle.settingsStore.currentSettings;
					const { frontmatter } = getFileAndFrontmatter(app, event.ref.filePath);
					const currentPrereqs = parseIntoList(frontmatter[settings.prerequisiteProp], {
						splitCommas: false,
					});
					openPrerequisiteAssignModal(app, bundle, currentPrereqs, (selected: string[]) => {
						void bundle.commandManager.executeCommand(assignPrerequisites(app, bundle, event.ref.filePath, selected));
					});
				})
		);
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Delete event")
				.setIcon("trash")
				.onClick(() => {
					void bundle.commandManager.executeCommand(new DeleteEventCommand(app, bundle, event.ref.filePath));
				})
		);
		menu.showAtMouseEvent(e);
	}

	function showArrowContextMenu(fromTaskId: string, toTaskId: string, e: MouseEvent): void {
		const toTask = cachedTaskMap.get(toTaskId);
		const fromTask = cachedTaskMap.get(fromTaskId);
		if (!toTask || !fromTask) return;
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(`Remove: ${fromTask.title} \u2192 ${toTask.title}`)
				.setIcon("unlink")
				.onClick(() => {
					const currentPrereqs = bundle.prerequisiteTracker.getPrerequisitesOf(toTask.filePath);
					const updated = currentPrereqs.filter((p) => p !== fromTask.filePath);
					void bundle.commandManager.executeCommand(assignPrerequisites(app, bundle, toTask.filePath, updated));
				})
		);
		menu.showAtMouseEvent(e);
	}

	const hooks: GanttInteractionHooks = {
		onBarClick: (taskId) => {
			const event = findEventByTaskId(taskId);
			if (event) openPreview(event);
		},
		onBarContextMenu: showBarContextMenu,
		onArrowContextMenu: showArrowContextMenu,
	};

	function computeLayout(viewport: Viewport): GanttRenderData {
		const bars = layoutBars(cachedPacked, viewport, GANTT_DEFAULTS);
		const barMap = new Map<string, BarLayout>(bars.map((b) => [b.taskId, b]));
		const arrows = layoutArrows(cachedPacked, barMap, GANTT_DEFAULTS);
		let maxRow = -1;
		for (const t of cachedTaskMap.values()) {
			if (t.row > maxRow) maxRow = t.row;
		}
		return { taskMap: cachedTaskMap, bars, barMap, arrows, rowCount: maxRow + 1 };
	}

	function rebuild(centerOnData: boolean): void {
		const allEvents = bundle.eventStore.getAllEvents();
		const { visible } = filterBar ? filterBar.filterEvents(allEvents) : { visible: allEvents };
		eventsByPath = new Map(visible.map((e) => [e.ref.filePath, e]));
		const graph = bundle.prerequisiteTracker.getGraph();
		if (!colorEvaluator) colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		const tasks = normalizeEvents(visible, graph, bundle.prerequisiteTracker, bundle, colorEvaluator);
		cachedPacked = packRows(tasks, GANTT_DEFAULTS);
		cachedTaskMap = new Map(cachedPacked.map((t) => [t.id, t]));
		if (!renderer && wrapperEl) {
			renderer = new GanttRenderer(wrapperEl, hooks);
		}
		renderer?.render(computeLayout, centerOnData ? cachedPacked : undefined);
	}

	function cleanupContent(): void {
		mergedSub?.unsubscribe();
		mergedSub = null;
		colorEvaluator?.destroy();
		colorEvaluator = null;
		filterBar?.destroy();
		filterBar = null;
		renderer?.destroy();
		renderer = null;
		wrapperEl = null;
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
				filterBar = createViewFilterBar(bundle, () => rebuild(false));
				const headerRow = el.createDiv({ cls: cls("view-header-row") });
				const headerLeft = headerRow.createDiv({ cls: cls("view-header-left") });
				headerLeft.appendChild(filterBar.el);

				const headerRight = headerRow.createDiv({ cls: cls("view-header-right") });
				const createBtn = headerRight.createEl("button", { cls: cls("gantt-create-btn") });
				setIcon(createBtn, "plus");
				createBtn.setAttribute("aria-label", "Create event");
				createBtn.addEventListener("click", () => {
					new EventCreateModal(app, bundle, { title: "", start: null }).open();
				});

				wrapperEl = el.createDiv({ cls: cls("gantt-wrapper") });
				rebuild(true);
				mergedSub = merge(
					bundle.eventStore.changes$,
					bundle.recurringEventManager.changes$,
					bundle.prerequisiteTracker.graph$
				)
					.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
					.subscribe(() => rebuild(false));
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
