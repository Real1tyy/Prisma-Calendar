import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { useOutsideClick } from "../hooks/dom/use-outside-click";
import { useFocusOnMount } from "../hooks/focus/use-focus";
import { useEscapeKey } from "../hooks/keyboard/use-trigger-keys";
import { useInjectedStyles } from "../hooks/styles/use-styles";
import { MenuEntry } from "./menu-items";
import type { ContextMenuEntryDef, ContextMenuSeparatorDef } from "./types";

// Scoped to our portaled React menu only (NOT Obsidian's global `.menu`), so we
// never restyle native menus. Adds a clear hover/focus highlight, a divider between
// rows, and vertical scrolling (the per-instance max-height is set inline from the
// anchor position).
const CONTEXT_MENU_CLASS = "shared-ctx-menu";
const CONTEXT_MENU_STYLES = `
.${CONTEXT_MENU_CLASS} {
	overflow-y: auto;
	overflow-x: hidden;
}
.${CONTEXT_MENU_CLASS} .menu-item {
	cursor: pointer;
	transition: background-color 0.12s ease;
}
.${CONTEXT_MENU_CLASS} > .menu-item:not(:last-child) {
	border-bottom: 1px solid var(--background-modifier-border);
}
.${CONTEXT_MENU_CLASS} .menu-item:hover,
.${CONTEXT_MENU_CLASS} .menu-item:focus,
.${CONTEXT_MENU_CLASS} .menu-item:focus-visible {
	background-color: var(--background-modifier-hover);
	outline: none;
}
.${CONTEXT_MENU_CLASS} .menu-item.is-disabled:hover {
	background-color: transparent;
	cursor: default;
}
`;

export interface ContextMenuProps {
	items: ContextMenuEntryDef[];
	position: { x: number; y: number };
	onDismiss: () => void;
	testIdPrefix?: string;
	/**
	 * Horizontal anchor. `"left"` (default) puts the menu's left edge at `position.x`
	 * and grows rightward — correct for a cursor-anchored right-click menu. `"right"`
	 * puts its RIGHT edge at `position.x` and grows leftward — use when anchoring to a
	 * control near the viewport's right edge (e.g. the page-header overflow trigger) so
	 * the menu opens into the viewport instead of spilling off the right edge.
	 */
	align?: "left" | "right";
}

export const ContextMenu = memo(function ContextMenu({
	items,
	position,
	onDismiss,
	testIdPrefix,
	align = "left",
}: ContextMenuProps) {
	useInjectedStyles(`${CONTEXT_MENU_CLASS}-styles`, CONTEXT_MENU_STYLES);
	const [focusIndex, setFocusIndex] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);

	useEscapeKey(onDismiss);

	const focusableItems = useMemo(
		() => items.filter((e): e is Exclude<ContextMenuEntryDef, ContextMenuSeparatorDef> => e.kind !== "separator"),
		[items]
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setFocusIndex((prev) => (prev + 1) % focusableItems.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setFocusIndex((prev) => (prev - 1 + focusableItems.length) % focusableItems.length);
			} else if (e.key === "Enter" && focusableItems[focusIndex]) {
				const focused = focusableItems[focusIndex];
				if (focused.kind === "item" && !focused.disabled) {
					focused.onSelect();
					onDismiss();
				} else if (focused.kind === "checkbox") {
					focused.onChange(!focused.checked);
					onDismiss();
				}
			}
		},
		[focusableItems, focusIndex, onDismiss]
	);

	useOutsideClick([menuRef], onDismiss);

	useFocusOnMount(menuRef);

	let focusableIdx = -1;

	return createPortal(
		<div
			ref={menuRef}
			className={`menu ${CONTEXT_MENU_CLASS}`}
			role="menu"
			tabIndex={-1}
			onKeyDown={handleKeyDown}
			style={{
				position: "fixed",
				// "right" anchors the menu's right edge at position.x and grows leftward so a
				// trigger near the viewport's right edge doesn't push the menu off-screen.
				...(align === "right" ? { right: Math.max(0, window.innerWidth - position.x) } : { left: position.x }),
				top: position.y,
				// Cap to the space below the anchor so a tall menu scrolls instead of
				// running off the bottom of the viewport.
				maxHeight: `calc(100vh - ${Math.round(position.y) + 8}px)`,
				zIndex: 1000,
			}}
			data-testid={`${testIdPrefix ?? ""}ctx-menu`}
		>
			{items.map((entry, idx) => {
				if (entry.kind !== "separator") focusableIdx++;
				const currentFocusIdx = focusableIdx;
				return (
					<MenuEntry
						key={entry.kind === "separator" ? `sep-${idx}` : (entry as { id: string }).id}
						entry={entry}
						onDismiss={onDismiss}
						focusIndex={focusIndex}
						index={currentFocusIdx}
						testIdPrefix={testIdPrefix}
					/>
				);
			})}
		</div>,
		document.body
	);
});
