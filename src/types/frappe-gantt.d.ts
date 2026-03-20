declare module "frappe-gantt" {
	export interface Task {
		id: string;
		name: string;
		start: string;
		end: string;
		progress: number;
		dependencies?: string[];
		color?: string;
		custom_class?: string;
	}

	export type ViewMode = "Day" | "Week" | "Month" | "Year";

	export interface GanttOptions {
		view_mode?: ViewMode;
		view_mode_select?: boolean;
		view_modes?: ViewMode[];
		bar_height?: number;
		bar_corner_radius?: number;
		column_width?: number;
		padding?: number;
		container_height?: number | "auto";
		upper_header_height?: number;
		lower_header_height?: number;
		arrow_curve?: number;
		snap_at?: string;
		infinite_padding?: boolean;
		move_dependencies?: boolean;
		readonly?: boolean;
		readonly_dates?: boolean;
		readonly_progress?: boolean;
		date_format?: string;
		language?: string;
		scroll_to?: string | Date;
		today_button?: boolean;
		lines?: "both" | "vertical" | "horizontal" | "none";
		popup_on?: "click" | "hover";
		popup?:
			| ((ctx: {
					task: Task;
					set_title: (t: string) => void;
					set_subtitle: (t: string) => void;
					set_details: (t: string) => void;
					chart: Gantt;
			  }) => void)
			| null;
		custom_popup_html?: ((task: Task) => string) | null;
		on_click?: (task: Task) => void;
		on_date_change?: (task: Task, start: Date, end: Date) => void;
		on_progress_change?: (task: Task, progress: number) => void;
		on_view_change?: (mode: { name: string }) => void;
	}

	export default class Gantt {
		tasks: Task[];
		constructor(wrapper: string | HTMLElement, tasks: Task[], options?: GanttOptions);
		refresh(tasks: Task[]): void;
		change_view_mode(mode?: ViewMode, scrollToToday?: boolean): void;
		update_options(options: Partial<GanttOptions>): void;
		scroll_current(): void;
	}
}
