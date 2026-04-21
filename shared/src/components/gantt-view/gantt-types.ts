import { z } from "zod";

export interface GanttTask {
	id: string;
	title: string;
	startMs: number;
	endMs: number;
	dependencies: string[];
	filePath: string;
	color?: string;
	allColors?: string[];
	dotColors?: string[];
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

export const GanttConfigSchema = z.object({
	barHeight: z.number().default(40),
	rowPadding: z.number().default(24),
	headerHeight: z.number().default(50),
	pxPerDay: z.number().default(135),
	labelCharWidth: z.number().default(8),
	todayLineColor: z.string().default("var(--color-accent)"),
});

export type GanttConfig = z.infer<typeof GanttConfigSchema>;

export const GANTT_DEFAULTS: GanttConfig = GanttConfigSchema.parse({});

export interface GanttInteractionHooks {
	onBarClick?: (taskId: string, e: MouseEvent) => void;
	onBarContextMenu?: (taskId: string, e: MouseEvent) => void;
	onArrowContextMenu?: (fromTaskId: string, toTaskId: string, e: MouseEvent) => void;
	onCanvasContextMenu?: (dateMs: number, e: MouseEvent) => void;
}

export const MS_PER_DAY = 86_400_000;
