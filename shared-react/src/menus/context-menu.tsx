import type { KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/use-escape-key";
import { MenuEntry } from "./menu-items";
import type { ContextMenuEntryDef, ContextMenuSeparatorDef } from "./types";

export interface ContextMenuProps {
	items: ContextMenuEntryDef[];
	position: { x: number; y: number };
	onDismiss: () => void;
	testIdPrefix?: string;
}

export const ContextMenu = memo(function ContextMenu({ items, position, onDismiss, testIdPrefix }: ContextMenuProps) {
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

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onDismiss();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onDismiss]);

	useEffect(() => {
		menuRef.current?.focus();
	}, []);

	let focusableIdx = -1;

	return createPortal(
		<div
			ref={menuRef}
			className="menu"
			role="menu"
			tabIndex={-1}
			onKeyDown={handleKeyDown}
			style={{
				position: "fixed",
				left: position.x,
				top: position.y,
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
