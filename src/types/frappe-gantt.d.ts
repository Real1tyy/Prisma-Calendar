declare module "frappe-gantt" {
	export interface Task {
		id: string;
		name: string;
		start: string; // "YYYY-MM-DD"
		end: string; // "YYYY-MM-DD"
		progress: number; // 0-100
		dependencies?: string;
		custom_class?: string;
	}

	export type ViewMode = "Day" | "Week" | "Month" | "Year" | "Quarter Day" | "Half Day";

	export interface GanttOptions {
		header_height?: number;
		column_width?: number;
		step?: number;
		view_modes?: ViewMode[];
		bar_height?: number;
		bar_corner_radius?: number;
		arrow_curve?: number;
		padding?: number;
		view_mode?: ViewMode;
		date_format?: string;
		popup_trigger?: string;
		custom_popup_html?: ((task: Task) => string) | null;
		language?: string;
		on_click?: (task: Task) => void;
		on_date_change?: (task: Task, start: Date, end: Date) => void;
		on_progress_change?: (task: Task, progress: number) => void;
		on_view_change?: (mode: ViewMode) => void;
	}

	export default class Gantt {
		constructor(wrapper: string | HTMLElement, tasks: Task[], options?: GanttOptions);
		refresh(tasks: Task[]): void;
		change_view_mode(mode: ViewMode): void;
		destroy(): void;
	}
}
