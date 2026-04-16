import type { GroupChildState, TabDefinition } from "./types";

export function reorderList<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
	const fromIdx = items.findIndex((t) => t.id === fromId);
	const toIdx = items.findIndex((t) => t.id === toId);
	if (fromIdx < 0 || toIdx < 0) return items;
	const updated = [...items];
	const [moved] = updated.splice(fromIdx, 1);
	updated.splice(toIdx, 0, moved);
	return updated;
}

function recalcActiveChildIndex(gs: GroupChildState, previousActiveId: string | undefined): void {
	gs.activeChildIndex = Math.max(
		0,
		gs.visibleChildren.findIndex((c) => c.id === previousActiveId)
	);
}

export function moveGroupChild(gs: GroupChildState, childId: string, direction: -1 | 1): void {
	const idx = gs.visibleChildren.findIndex((c) => c.id === childId);
	const newIdx = idx + direction;
	if (idx < 0 || newIdx < 0 || newIdx >= gs.visibleChildren.length) return;
	const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
	const arr = [...gs.visibleChildren];
	[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
	gs.visibleChildren = arr;
	recalcActiveChildIndex(gs, activeId);
}

export function reorderGroupChildren(gs: GroupChildState, fromId: string, toId: string): void {
	const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
	gs.visibleChildren = reorderList(gs.visibleChildren, fromId, toId);
	recalcActiveChildIndex(gs, activeId);
}

export function hideGroupChild(gs: GroupChildState, child: TabDefinition): void {
	if (gs.visibleChildren.length <= 1) return;
	const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
	gs.visibleChildren = gs.visibleChildren.filter((c) => c.id !== child.id);
	if (activeId === child.id) {
		gs.activeChildIndex = Math.min(gs.activeChildIndex, gs.visibleChildren.length - 1);
	} else {
		recalcActiveChildIndex(gs, activeId);
	}
}

export function showGroupChild(gs: GroupChildState, child: TabDefinition): void {
	gs.visibleChildren = [...gs.visibleChildren, child];
}
