import {
	cls,
	ColorEvaluator,
	type ContextMenuHandle,
	type ContextMenuItemDefinition,
	createContextMenu,
	parseIntoList,
	type TabDefinition,
} from "@real1ty-obsidian-plugins";
import { type App, Menu, Notice } from "obsidian";
import { debounceTime, distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import {
	addPrerequisite,
	assignCategories,
	assignPrerequisites,
	markAsDone,
	markAsUndone,
	toggleSkip,
} from "../../core/commands/frontmatter-update-command";
import { CloneEventCommand, DeleteEventCommand } from "../../core/commands/lifecycle-commands";
import { PRO_FEATURES } from "../../core/license";
import type {
	BarLayout,
	GanttInteractionHooks,
	GanttRenderData,
	GanttRendererHandle,
	PackedTask,
	Viewport,
} from "../../gantt";
import {
	createGanttRenderer,
	GANTT_DEFAULTS,
	layoutArrows,
	layoutBars,
	normalizeEvents,
	packRows,
	sanitizeGanttId,
} from "../../gantt";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { isEventDone } from "../../utils/event-frontmatter";
import { extractCleanDisplayName } from "../../utils/event-naming";
import { getFileAndFrontmatter, openFileInNewWindow } from "../../utils/obsidian";
import { showEventPreviewModal } from "../modals";
import { openCategoryAssignModal } from "../modals/category/assignment";
import { EventCreateModal } from "../modals/event/event-create-modal";
import { EventEditModal } from "../modals/event/event-edit-modal";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";
import { createStickyBanner, type StickyBannerHandle } from "../sticky-banner";
import { createViewFilterBar, type ViewFilterBarHandle } from "../view-filter-bar";

const REFRESH_DEBOUNCE_MS = 100;

export { sanitizeGanttId };

function buildBarMenuItems(
	app: App,
	bundle: CalendarBundle,
	getEvent: () => CalendarEvent | undefined,
	exec: (cmd: Parameters<typeof bundle.commandManager.executeCommand>[0]) => void,
	onAssignPrerequisite: (ev: CalendarEvent) => void
): ContextMenuItemDefinition[] {
	const act = (action: (ev: CalendarEvent) => void): (() => void) => {
		return () => {
			const ev = getEvent();
			if (ev) action(ev);
		};
	};

	return [
		{
			id: "enlarge",
			label: "Enlarge",
			icon: "maximize-2",
			section: "view",
			onAction: act((ev) => {
				showEventPreviewModal(app, bundle, {
					title: ev.title,
					start: new Date(ev.start),
					end: ev.type === "timed" ? new Date(ev.end) : null,
					allDay: ev.allDay,
					extendedProps: { filePath: ev.ref.filePath },
				});
			}),
		},
		{
			id: "edit",
			label: "Edit event",
			icon: "pencil",
			section: "view",
			onAction: act((ev) => {
				new EventEditModal(app, bundle, {
					title: ev.title,
					start: ev.start,
					end: ev.type === "timed" ? ev.end : null,
					allDay: ev.allDay,
					extendedProps: { filePath: ev.ref.filePath },
				}).open();
			}),
		},
		{
			id: "open-file",
			label: "Open file",
			icon: "file-text",
			section: "view",
			onAction: act((ev) => void app.workspace.openLinkText(ev.ref.filePath, "", false)),
		},
		{
			id: "open-file-new-window",
			label: "Open file in new window",
			icon: "external-link",
			section: "view",
			onAction: act((ev) => openFileInNewWindow(app, ev.ref.filePath)),
		},
		{
			id: "mark-done",
			label: "Mark as done",
			icon: "check",
			section: "status",
			onAction: act((ev) => {
				const settings = bundle.settingsStore.currentSettings;
				const done = isEventDone(app, ev.ref.filePath, settings.statusProperty, settings.doneValue);
				exec(done ? markAsUndone(app, bundle, ev.ref.filePath) : markAsDone(app, bundle, ev.ref.filePath));
			}),
		},
		{
			id: "skip",
			label: "Skip event",
			icon: "eye-off",
			section: "status",
			onAction: act((ev) => exec(toggleSkip(app, bundle, ev.ref.filePath))),
		},
		{
			id: "assign-prerequisites",
			label: "Assign prerequisites",
			icon: "link",
			section: "organize",
			onAction: act((ev) => onAssignPrerequisite(ev)),
		},
		{
			id: "assign-categories",
			label: "Assign categories",
			icon: "tag",
			section: "organize",
			onAction: act((ev) => {
				const settings = bundle.settingsStore.currentSettings;
				const { frontmatter } = getFileAndFrontmatter(app, ev.ref.filePath);
				const currentCats = parseIntoList(frontmatter[settings.categoryProp], { splitCommas: true });
				const categories = bundle.categoryTracker.getCategoriesWithColors();
				openCategoryAssignModal(app, categories, settings.defaultNodeColor, currentCats, (selected: string[]) => {
					exec(assignCategories(app, bundle, ev.ref.filePath, selected));
				});
			}),
		},
		{
			id: "duplicate",
			label: "Duplicate",
			icon: "copy",
			section: "actions",
			onAction: act((ev) => exec(new CloneEventCommand(app, bundle, ev.ref.filePath))),
		},
		{
			id: "delete",
			label: "Delete event",
			icon: "trash",
			section: "danger",
			onAction: act((ev) => exec(new DeleteEventCommand(app, bundle, ev.ref.filePath))),
		},
	];
}

export function createGanttTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let renderer: GanttRendererHandle | null = null;
	let mergedSub: Subscription | null = null;
	let isProSub: Subscription | null = null;
	let wrapperEl: HTMLElement | null = null;
	let eventsByPath = new Map<string, CalendarEvent>();
	let colorEvaluator: ColorEvaluator<SingleCalendarConfig> | null = null;
	let filterBar: ViewFilterBarHandle | null = null;
	let barContextMenu: ContextMenuHandle | null = null;

	let cachedPacked: PackedTask[] = [];
	let cachedTaskMap = new Map<string, PackedTask>();
	let activeMenuTaskId: string | null = null;

	let prereqTargetFilePath: string | null = null;
	let prereqBanner: StickyBannerHandle | null = null;

	function findEventByTaskId(taskId: string): CalendarEvent | undefined {
		const task = cachedTaskMap.get(taskId);
		return task ? eventsByPath.get(task.filePath) : undefined;
	}

	function getActiveEvent(): CalendarEvent | undefined {
		return activeMenuTaskId ? findEventByTaskId(activeMenuTaskId) : undefined;
	}

	function exec(cmd: Parameters<typeof bundle.commandManager.executeCommand>[0]): void {
		void bundle.commandManager.executeCommand(cmd);
	}

	function enterPrereqSelection(ev: CalendarEvent): void {
		exitPrereqSelection();
		prereqTargetFilePath = ev.ref.filePath;

		if (!renderer) return;
		prereqBanner = createStickyBanner(
			renderer.toolbarLeft,
			`Click a bar to assign it as a prerequisite for "${extractCleanDisplayName(ev.ref.filePath)}"`,
			() => {
				exitPrereqSelection();
				new Notice("Prerequisite selection cancelled");
			}
		);
	}

	function exitPrereqSelection(): void {
		prereqTargetFilePath = null;
		prereqBanner?.destroy();
		prereqBanner = null;
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
					exec(assignPrerequisites(app, bundle, toTask.filePath, updated));
				})
		);
		menu.showAtMouseEvent(e);
	}

	const hooks: GanttInteractionHooks = {
		onBarClick: (taskId) => {
			const event = findEventByTaskId(taskId);
			if (!event) return;

			if (prereqTargetFilePath) {
				if (event.ref.filePath === prereqTargetFilePath) {
					new Notice("Cannot assign an event as its own prerequisite");
					return;
				}
				const target = prereqTargetFilePath;
				exitPrereqSelection();
				exec(addPrerequisite(app, bundle, target, event.ref.filePath));
				new Notice("Prerequisite assigned");
				return;
			}

			showEventPreviewModal(app, bundle, {
				title: event.title,
				start: new Date(event.start),
				end: event.type === "timed" ? new Date(event.end) : null,
				allDay: event.allDay,
				extendedProps: { filePath: event.ref.filePath },
			});
		},
		onBarContextMenu: (taskId, e) => {
			activeMenuTaskId = taskId;
			if (!barContextMenu) return;

			const event = findEventByTaskId(taskId);
			if (!event) return;

			const settings = bundle.settingsStore.currentSettings;
			const done = isEventDone(app, event.ref.filePath, settings.statusProperty, settings.doneValue);
			const titleOverrides: Record<string, string> = {};
			if (done) titleOverrides["mark-done"] = "Mark as undone";

			barContextMenu.show(e, undefined, titleOverrides);
		},
		onArrowContextMenu: showArrowContextMenu,
	};

	function computeLayout(viewport: Viewport): GanttRenderData {
		const bars = layoutBars(cachedPacked, viewport, GANTT_DEFAULTS);
		const barMap = new Map<string, BarLayout>(bars.map((b) => [b.taskId, b]));
		const arrows = layoutArrows(cachedPacked, barMap, GANTT_DEFAULTS);
		const rowCount = cachedPacked.length > 0 ? Math.max(...cachedPacked.map((t) => t.row)) + 1 : 0;
		return { taskMap: cachedTaskMap, bars, barMap, arrows, rowCount };
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
		renderer?.render(computeLayout, centerOnData ? cachedPacked : undefined);
	}

	function cleanupContent(): void {
		exitPrereqSelection();
		mergedSub?.unsubscribe();
		mergedSub = null;
		colorEvaluator?.destroy();
		colorEvaluator = null;
		filterBar?.destroy();
		filterBar = null;
		barContextMenu?.destroy();
		barContextMenu = null;
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

				barContextMenu = createContextMenu({
					items: buildBarMenuItems(app, bundle, getActiveEvent, exec, enterPrereqSelection),
					cssPrefix: "prisma-",
					...(bundle.settingsStore.currentSettings.ganttContextMenuState
						? { initialState: bundle.settingsStore.currentSettings.ganttContextMenuState }
						: {}),
					onStateChange: (state) => {
						void bundle.settingsStore.updateSettings((s) => ({
							...s,
							ganttContextMenuState: state,
						}));
					},
					editable: true,
					app,
				});

				wrapperEl = el.createDiv({ cls: cls("gantt-wrapper") });
				renderer = createGanttRenderer(wrapperEl, hooks, { cssPrefix: "prisma-" });

				const createBtn = renderer.toolbarLeft.createEl("button", {
					cls: cls("gantt-create-btn"),
					text: "Create",
				});
				createBtn.addEventListener("click", () => {
					new EventCreateModal(app, bundle, { title: "", start: null }).open();
				});

				filterBar = createViewFilterBar(bundle, () => rebuild(false));
				renderer.toolbarLeft.appendChild(filterBar.el);

				rebuild(false);
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
