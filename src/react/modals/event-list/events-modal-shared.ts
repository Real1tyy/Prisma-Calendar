export const EVENTS_MODAL_SORT_OPTIONS = {
	"count-desc": "Count ↓",
	"count-asc": "Count ↑",
	"name-asc": "Name A→Z",
	"name-desc": "Name Z→A",
} as const;

export type EventsModalSortMode = keyof typeof EVENTS_MODAL_SORT_OPTIONS;

export type EventsModalTabId = "recurring" | "byCategory" | "byName";

export function sortEventsModalItems<T extends { title: string }>(
	items: T[],
	getCount: (i: T) => number,
	mode: EventsModalSortMode
): T[] {
	const sorted = [...items];
	switch (mode) {
		case "count-desc":
			sorted.sort((a, b) => getCount(b) - getCount(a) || a.title.localeCompare(b.title));
			break;
		case "count-asc":
			sorted.sort((a, b) => getCount(a) - getCount(b) || a.title.localeCompare(b.title));
			break;
		case "name-asc":
			sorted.sort((a, b) => a.title.localeCompare(b.title));
			break;
		case "name-desc":
			sorted.sort((a, b) => b.title.localeCompare(a.title));
			break;
	}
	return sorted;
}

export function filterEventsModalItemsByQuery<T extends { title: string }>(items: T[], query: string): T[] {
	if (!query.trim()) return items;
	const q = query.toLowerCase().trim();
	return items.filter((item) => item.title.toLowerCase().includes(q));
}
