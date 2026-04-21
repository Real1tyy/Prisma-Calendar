import type { ColorEvaluator, GanttTask } from "@real1ty-obsidian-plugins";
import { MS_PER_DAY } from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../core/calendar-bundle";
import type { DependencyGraph } from "../core/dependency-graph";
import type { PrerequisiteTracker } from "../core/prerequisite-tracker";
import type { CalendarEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";
import { resolveAllEventColors } from "../utils/event-color";

export type {
	ArrowLayout,
	BarLayout,
	GanttConfig,
	GanttInteractionHooks,
	GanttRenderData,
	GanttRendererConfig,
	GanttRendererHandle,
	GanttTask,
	LayoutFn,
	PackedTask,
	Viewport,
} from "@real1ty-obsidian-plugins";
export {
	buildViewport,
	centerViewportOnTasks,
	createGanttRenderer,
	GANTT_DEFAULTS,
	layoutArrows,
	layoutBars,
	MS_PER_DAY,
	packRows,
	visualEndTime,
} from "@real1ty-obsidian-plugins";

export function sanitizeGanttId(filePath: string): string {
	return filePath.replace(/[^a-zA-Z0-9]/g, "_");
}

function getTaskTimestamps(event: CalendarEvent): { startMs: number; endMs: number } {
	const startDate = new Date(event.start);
	const startMs = startDate.getTime();

	if (event.type === "allDay") {
		return { startMs, endMs: startMs + MS_PER_DAY };
	}

	const endMs = new Date(event.end).getTime();

	if (endMs - startMs < MS_PER_DAY) {
		return { startMs, endMs: startMs + MS_PER_DAY };
	}

	return { startMs, endMs };
}

export function normalizeEvents(
	events: CalendarEvent[],
	graph: DependencyGraph,
	tracker: PrerequisiteTracker,
	bundle: CalendarBundle,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): GanttTask[] {
	return events
		.filter((event) => tracker.isConnected(event.ref.filePath))
		.map((event) => {
			const { startMs, endMs } = getTaskTimestamps(event);
			const prereqs = graph.get(event.ref.filePath) ?? [];
			const allColors = resolveAllEventColors(event.meta ?? {}, bundle, colorEvaluator);
			const settings = bundle.settingsStore.currentSettings;
			const colorModeCount = settings.colorMode === "off" ? 0 : Number(settings.colorMode);
			const useMultiColor = colorModeCount >= 2 && allColors.length >= 2;

			const dotColors =
				settings.showEventColorDots && allColors.length > colorModeCount ? allColors.slice(colorModeCount) : undefined;

			return {
				id: sanitizeGanttId(event.ref.filePath),
				title: event.title,
				startMs,
				endMs,
				dependencies: prereqs.map(sanitizeGanttId),
				filePath: event.ref.filePath,
				color: allColors[0],
				...(useMultiColor ? { allColors } : {}),
				...(dotColors ? { dotColors } : {}),
			};
		});
}
