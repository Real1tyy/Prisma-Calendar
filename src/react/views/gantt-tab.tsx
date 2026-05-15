import { cls, ColorEvaluator, parseIntoList } from "@real1ty-obsidian-plugins";
import {
	createCustomizableContextMenu,
	type CustomizableContextMenuHandle,
	type CustomizableContextMenuItem,
	renderReactInline,
	useApp,
	useObservable,
} from "@real1ty-obsidian-plugins-react";
import { type App, Menu, Notice } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { BehaviorSubject, debounceTime, distinctUntilChanged, map, merge, skip } from "rxjs";

import { injectOverflowDots } from "../../components/calendar-event-renderer";
import type {
	BarLayout,
	GanttInteractionHooks,
	GanttRenderData,
	GanttRendererHandle,
	PackedTask,
	Viewport,
} from "../../components/gantt";
import {
	createGanttRenderer,
	GANTT_DEFAULTS,
	layoutArrows,
	layoutBars,
	normalizeEvents,
	packRows,
} from "../../components/gantt";
import { showEventPreviewModal } from "../../components/modals";
import { CSS_PREFIX } from "../../constants";
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
import { openCategoryAssignModal } from "../../react/modals";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { getGanttRenderingKey } from "../../utils/calendar/settings";
import { isEventDone } from "../../utils/events/frontmatter";
import { extractCleanDisplayName } from "../../utils/events/naming";
import { getFileAndFrontmatter, openFileInNewWindow } from "../../utils/obsidian";
import { BundleContext, useBundle } from "../contexts/bundle-context";
import { openEventCreateModal } from "../modals/event/event-create-modal";
import { openEventEditModal } from "../modals/event/event-edit-modal";
import { FilterBar, type FilterBarHandle } from "./filter-bar";
import { ProGatedContent } from "./pro-gated-content";
import { StickyBanner } from "./sticky-banner";

const REFRESH_DEBOUNCE_MS = 100;

interface PrereqState {
	targetFilePath: string;
}

const PASS_ALL: FilterBarHandle = { shouldInclude: () => true };

function buildBarMenuItems(
	app: App,
	bundle: CalendarBundle,
	getEvent: () => CalendarEvent | undefined,
	runCmd: (cmd: Parameters<typeof bundle.commandManager.executeCommand>[0]) => void,
	onAssignPrerequisite: (ev: CalendarEvent) => void
): CustomizableContextMenuItem[] {
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
				openEventEditModal(app, bundle, {
					title: ev.title,
					start: ev.start,
					end: ev.type === "timed" ? ev.end : null,
					allDay: ev.allDay,
					extendedProps: { filePath: ev.ref.filePath },
				});
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
			onAction: act((ev) => void openFileInNewWindow(app, ev.ref.filePath)),
		},
		{
			id: "mark-done",
			label: "Mark as done",
			icon: "check",
			section: "status",
			onAction: act((ev) => {
				const settings = bundle.settingsStore.currentSettings;
				const done = isEventDone(app, ev.ref.filePath, settings.statusProperty, settings.doneValue);
				runCmd(done ? markAsUndone(bundle, ev.ref.filePath) : markAsDone(bundle, ev.ref.filePath));
			}),
		},
		{
			id: "skip",
			label: "Skip event",
			icon: "eye-off",
			section: "status",
			onAction: act((ev) => runCmd(toggleSkip(bundle, ev.ref.filePath))),
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
				void openCategoryAssignModal(app, categories, settings.defaultNodeColor, currentCats).then((selected) => {
					if (selected) void bundle.commandManager.executeCommand(assignCategories(bundle, ev.ref.filePath, selected));
				});
			}),
		},
		{
			id: "duplicate",
			label: "Duplicate",
			icon: "copy",
			section: "actions",
			onAction: act((ev) => runCmd(new CloneEventCommand(app, bundle, ev.ref.filePath))),
		},
		{
			id: "delete",
			label: "Delete event",
			icon: "trash",
			section: "danger",
			onAction: act((ev) => runCmd(new DeleteEventCommand(bundle.fileRepository, ev.ref.filePath))),
		},
	];
}

interface GanttToolbarProps {
	prereqState$: BehaviorSubject<PrereqState | null>;
	onCreate: () => void;
	onCancelPrereq: () => void;
	onFilterChange: () => void;
	onFilterReady: (handle: FilterBarHandle) => void;
}

const GanttToolbar = memo(function GanttToolbar({
	prereqState$,
	onCreate,
	onCancelPrereq,
	onFilterChange,
	onFilterReady,
}: GanttToolbarProps) {
	const prereq = useObservable(prereqState$, prereqState$.getValue());

	return (
		<>
			<button className={`${CSS_PREFIX}gantt-create-btn`} onClick={onCreate} data-testid={`${CSS_PREFIX}gantt-create`}>
				Create
			</button>
			<FilterBar onFilterChange={onFilterChange} onHandleReady={onFilterReady} />
			{prereq && (
				<StickyBanner
					message={`Click a bar to assign it as a prerequisite for "${extractCleanDisplayName(prereq.targetFilePath)}"`}
					onCancel={onCancelPrereq}
				/>
			)}
		</>
	);
});

const GanttBody = memo(function GanttBody() {
	const app = useApp();
	const bundle = useBundle();
	const containerRef = useRef<HTMLDivElement>(null);
	const filterRef = useRef<FilterBarHandle>(PASS_ALL);
	const rebuildRef = useRef<(centerOnData: boolean) => void>(() => {});
	const prereqState$ = useMemo(() => new BehaviorSubject<PrereqState | null>(null), []);

	const handleFilterReady = useCallback((handle: FilterBarHandle) => {
		filterRef.current = handle;
	}, []);

	const handleFilterChange = useCallback(() => {
		rebuildRef.current(false);
	}, []);

	const handleCreate = useCallback(() => {
		openEventCreateModal(app, bundle, { title: "", start: null });
	}, [app, bundle]);

	const handleCancelPrereq = useCallback(() => {
		prereqState$.next(null);
		new Notice("Prerequisite selection cancelled");
	}, [prereqState$]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let renderer: GanttRendererHandle | null = null;
		let wrapperEl: HTMLElement | null = null;
		let eventsByPath = new Map<string, CalendarEvent>();
		let colorEvaluator: ColorEvaluator<SingleCalendarConfig> | null = null;
		let barContextMenu: CustomizableContextMenuHandle | null = null;

		let cachedPacked: PackedTask[] = [];
		let cachedTaskMap = new Map<string, PackedTask>();
		let activeMenuTaskId: string | null = null;
		let barObserver: MutationObserver | null = null;

		function findEventByTaskId(taskId: string): CalendarEvent | undefined {
			const task = cachedTaskMap.get(taskId);
			return task ? eventsByPath.get(task.filePath) : undefined;
		}

		function getActiveEvent(): CalendarEvent | undefined {
			return activeMenuTaskId ? findEventByTaskId(activeMenuTaskId) : undefined;
		}

		function runCmd(cmd: Parameters<typeof bundle.commandManager.executeCommand>[0]): void {
			void bundle.commandManager.executeCommand(cmd);
		}

		function enterPrereqSelection(ev: CalendarEvent): void {
			prereqState$.next({ targetFilePath: ev.ref.filePath });
		}

		function showArrowContextMenu(fromTaskId: string, toTaskId: string, e: MouseEvent): void {
			const toTask = cachedTaskMap.get(toTaskId);
			const fromTask = cachedTaskMap.get(fromTaskId);
			if (!toTask || !fromTask) return;
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle(`Remove: ${fromTask.title} → ${toTask.title}`)
					.setIcon("unlink")
					.onClick(() => {
						const currentPrereqs = bundle.prerequisiteTracker.getPrerequisitesOf(toTask.filePath);
						const updated = currentPrereqs.filter((p) => p !== fromTask.filePath);
						runCmd(assignPrerequisites(bundle, toTask.filePath, updated));
					})
			);
			menu.showAtMouseEvent(e);
		}

		const hooks: GanttInteractionHooks = {
			onBarClick: (taskId) => {
				const event = findEventByTaskId(taskId);
				if (!event) return;

				const prereq = prereqState$.getValue();
				if (prereq) {
					if (event.ref.filePath === prereq.targetFilePath) {
						new Notice("Cannot assign an event as its own prerequisite");
						return;
					}
					prereqState$.next(null);
					runCmd(addPrerequisite(bundle, prereq.targetFilePath, event.ref.filePath));
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
			const visible = allEvents.filter((event) => filterRef.current.shouldInclude(event));
			eventsByPath = new Map(visible.map((e) => [e.ref.filePath, e]));
			const graph = bundle.prerequisiteTracker.getGraph();
			if (!colorEvaluator) colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
			const tasks = normalizeEvents(visible, graph, bundle.prerequisiteTracker, bundle, colorEvaluator);
			cachedPacked = packRows(tasks, GANTT_DEFAULTS);
			cachedTaskMap = new Map(cachedPacked.map((t) => [t.id, t]));
			renderer?.render(computeLayout, centerOnData ? cachedPacked : undefined);
		}
		rebuildRef.current = rebuild;

		barContextMenu = createCustomizableContextMenu({
			items: buildBarMenuItems(app, bundle, getActiveEvent, runCmd, enterPrereqSelection),
			cssPrefix: CSS_PREFIX,
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
		renderer = createGanttRenderer(wrapperEl, hooks, { cssPrefix: CSS_PREFIX });

		const barContainer = wrapperEl.querySelector(`.${cls("gantt-bar-container")}`);
		if (barContainer) {
			barObserver = new MutationObserver(() => {
				for (const barEl of Array.from(barContainer.querySelectorAll<HTMLElement>("[data-task-id]"))) {
					barEl.querySelector(`.${cls("gantt-bar-color-dots")}`)?.remove();
					const taskId = barEl.getAttribute("data-task-id");
					const task = taskId ? cachedTaskMap.get(taskId) : undefined;
					injectOverflowDots(barEl, task?.dotColors ?? [], cls("compact-color-dots"), cls("compact-color-dot"));
				}
			});
			barObserver.observe(barContainer, { childList: true });
		}

		const unmountToolbar = renderReactInline(
			renderer.toolbarLeft,
			<BundleContext value={bundle}>
				<GanttToolbar
					prereqState$={prereqState$}
					onCreate={handleCreate}
					onCancelPrereq={handleCancelPrereq}
					onFilterChange={handleFilterChange}
					onFilterReady={handleFilterReady}
				/>
			</BundleContext>,
			app,
			{ cssPrefix: CSS_PREFIX }
		);

		rebuild(false);

		const renderingSettings$ = bundle.settingsStore.settings$.pipe(
			skip(1),
			map(getGanttRenderingKey),
			distinctUntilChanged()
		);

		const sub = merge(
			bundle.eventStore.changes$,
			bundle.recurringEventManager.changes$,
			bundle.prerequisiteTracker.graph$,
			renderingSettings$
		)
			.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
			.subscribe(() => rebuild(false));

		return () => {
			prereqState$.next(null);
			sub.unsubscribe();
			unmountToolbar();
			colorEvaluator?.destroy();
			colorEvaluator = null;
			barContextMenu?.destroy();
			barContextMenu = null;
			barObserver?.disconnect();
			barObserver = null;
			renderer?.destroy();
			renderer = null;
			wrapperEl = null;
			rebuildRef.current = () => {};
			filterRef.current = PASS_ALL;
		};
	}, [app, bundle, prereqState$, handleCreate, handleCancelPrereq, handleFilterChange, handleFilterReady]);

	return (
		<div
			ref={containerRef}
			style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}
			data-testid={`${CSS_PREFIX}gantt-tab`}
		/>
	);
});

export const GanttTab = memo(function GanttTab() {
	const bundle = useBundle();
	const isPro = useObservable(bundle.plugin.licenseManager.isPro$, bundle.plugin.licenseManager.isPro);

	return (
		<ProGatedContent
			featureName={PRO_FEATURES.GANTT}
			description="Define dependencies between events and visualize them in a Gantt chart. Track task order and project timelines."
			previewKey="GANTT"
		>
			{isPro ? <GanttBody /> : null}
		</ProGatedContent>
	);
});
