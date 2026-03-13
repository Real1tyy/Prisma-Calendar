import type { Workspace, WorkspaceLeaf } from "obsidian";

export type LeafPlacement = "tab" | "left-sidebar" | "right-sidebar";

export interface ActivateViewConfig {
	viewType: string;
	placement: LeafPlacement;
	/**
	 * When true, detaches the view if it's already open instead of revealing it.
	 * Useful for sidebar panels that should toggle on/off.
	 */
	toggle?: boolean;
	/**
	 * Called after the leaf is revealed (both for existing and newly created leaves).
	 */
	onReveal?: (leaf: WorkspaceLeaf) => void | Promise<void>;
}

function getOrCreateLeaf(workspace: Workspace, placement: LeafPlacement): WorkspaceLeaf | null {
	switch (placement) {
		case "tab":
			return workspace.getLeaf("tab");
		case "left-sidebar":
			return workspace.getLeftLeaf(false);
		case "right-sidebar":
			return workspace.getRightLeaf(false);
	}
}

export async function activateView(workspace: Workspace, config: ActivateViewConfig): Promise<WorkspaceLeaf | null> {
	const { viewType, placement, toggle, onReveal } = config;

	const existingLeaves = workspace.getLeavesOfType(viewType);

	if (existingLeaves.length > 0) {
		if (toggle) {
			workspace.detachLeavesOfType(viewType);
			return null;
		}
		const leaf = existingLeaves[0];
		await workspace.revealLeaf(leaf);
		await onReveal?.(leaf);
		return leaf;
	}

	const leaf = getOrCreateLeaf(workspace, placement);
	if (!leaf) return null;

	await leaf.setViewState({ type: viewType, active: true });
	await workspace.revealLeaf(leaf);
	await onReveal?.(leaf);
	return leaf;
}
