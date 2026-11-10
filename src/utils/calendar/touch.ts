import { Platform } from "obsidian";

export function isTouchContextMenu(e: MouseEvent): boolean {
	if ("pointerType" in e && e.pointerType) return e.pointerType === "touch";
	// Older mobile WebViews emit MouseEvent without pointerType for a long-press.
	return Platform.isMobile;
}
