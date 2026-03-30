export interface GanttTask {
	id: string;
	title: string;
	startMs: number;
	endMs: number;
	dependencies: string[];
	filePath: string;
	color?: string;
}

export interface PackedTask extends GanttTask {
	row: number;
	visualEndMs: number;
}

export interface Viewport {
	startMs: number;
	widthPx: number;
	heightPx: number;
	pxPerDay: number;
	toX(ms: number): number;
	toWidth(startMs: number, endMs: number): number;
	toMs(x: number): number;
	endMs: number;
}

export interface BarLayout {
	taskId: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ArrowLayout {
	fromTaskId: string;
	toTaskId: string;
	path: string;
}

export interface GanttConfig {
	barHeight: number;
	rowPadding: number;
	headerHeight: number;
	pxPerDay: number;
	labelCharWidth: number;
	todayLineColor: string;
}

export interface GanttInteractionHooks {
	onBarClick?: (taskId: string, e: MouseEvent) => void;
	onBarContextMenu?: (taskId: string, e: MouseEvent) => void;
	onArrowContextMenu?: (fromTaskId: string, toTaskId: string, e: MouseEvent) => void;
	onCanvasContextMenu?: (dateMs: number, e: MouseEvent) => void;
}

export const GANTT_DEFAULTS: GanttConfig = {
	barHeight: 40,
	rowPadding: 24,
	headerHeight: 50,
	pxPerDay: 135,
	labelCharWidth: 8,
	todayLineColor: "var(--color-accent)",
};

export const MS_PER_DAY = 86_400_000;
export const SVG_NS = "http://www.w3.org/2000/svg";
