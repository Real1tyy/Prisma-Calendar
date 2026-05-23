import { generateColors, type ChartDataItem } from "@real1ty-obsidian-plugins";

export interface ColumnDef {
	key: string;
	label: string;
	sortable?: boolean;
	align?: "left" | "center" | "right";
}

export interface DashboardItem {
	key: string;
	title: string;
	count: number;
	color?: string;
	extraProps: Record<string, string | number>;
}

export interface StatEntry {
	label: string;
	value: string | number;
}

export function buildChartDataFromItems(items: DashboardItem[]): ChartDataItem[] {
	const sorted = [...items].sort((a, b) => b.count - a.count);

	const allHaveColor = sorted.length > 0 && sorted.every((i) => i.color);
	if (allHaveColor) {
		return sorted.map((item) => ({
			label: item.title,
			value: item.count,
			color: item.color ?? "",
		}));
	}

	const colors = generateColors(sorted.length);
	return sorted.map((item, i) => ({
		label: item.title,
		value: item.count,
		color: item.color ?? colors[i],
	}));
}
