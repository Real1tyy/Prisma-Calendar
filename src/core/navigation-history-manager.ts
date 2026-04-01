import { HistoryStack } from "@real1ty-obsidian-plugins";

export interface NavigationEntry {
	date: Date;
	viewType: string;
}

export const createNavigationHistory = () =>
	new HistoryStack<NavigationEntry>({
		equals: (a, b) => a.viewType === b.viewType && a.date.getTime() === b.date.getTime(),
	});
