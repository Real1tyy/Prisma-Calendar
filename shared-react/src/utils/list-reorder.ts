/**
 * Pure list-reorder helpers shared by the customizable-UI stores
 * (page-header, tabbed-container, …). Operate on any `{ id: string }`
 * list and return a new array — never mutate the input.
 */

/** Move `fromId` to `toId`'s slot. Returns the original array when either ID is missing. */
export function reorderList<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
	const fromIdx = items.findIndex((t) => t.id === fromId);
	const toIdx = items.findIndex((t) => t.id === toId);
	if (fromIdx < 0 || toIdx < 0) return items;
	const updated = [...items];
	const [moved] = updated.splice(fromIdx, 1);
	updated.splice(toIdx, 0, moved);
	return updated;
}

/** Swap the item with its neighbour in `direction`. Returns the original array when at a boundary. */
export function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
	const idx = items.findIndex((t) => t.id === id);
	const newIdx = idx + direction;
	if (idx < 0 || newIdx < 0 || newIdx >= items.length) return items;
	const updated = [...items];
	[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
	return updated;
}
