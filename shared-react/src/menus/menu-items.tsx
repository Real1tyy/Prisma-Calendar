import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ObsidianIcon } from "../components/obsidian-icon";
import type { ContextMenuCheckboxDef, ContextMenuEntryDef, ContextMenuItemDef, ContextMenuSubmenuDef } from "./types";

export interface MenuEntryProps {
	entry: ContextMenuEntryDef;
	onDismiss: () => void;
	focusIndex: number;
	index: number;
	testIdPrefix: string | undefined;
}

function MenuItemRow({
	entry,
	onDismiss,
	focusIndex,
	index,
	testIdPrefix,
}: {
	entry: ContextMenuItemDef;
	onDismiss: () => void;
	focusIndex: number;
	index: number;
	testIdPrefix: string | undefined;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (focusIndex === index) ref.current?.focus();
	}, [focusIndex, index]);

	const handleClick = useCallback(() => {
		if (entry.disabled) return;
		entry.onSelect();
		onDismiss();
	}, [entry, onDismiss]);

	return (
		<div
			ref={ref}
			role="menuitem"
			tabIndex={focusIndex === index ? 0 : -1}
			className={`menu-item${entry.disabled ? " is-disabled" : ""}`}
			onClick={handleClick}
			data-testid={`${testIdPrefix ?? ""}ctx-item-${entry.id}`}
		>
			{entry.icon && (
				<span className="menu-item-icon">
					<ObsidianIcon icon={entry.icon} />
				</span>
			)}
			<span className="menu-item-title">{entry.label}</span>
			{entry.shortcut && <span className="menu-item-shortcut">{entry.shortcut}</span>}
		</div>
	);
}

function MenuCheckboxRow({
	entry,
	onDismiss,
	focusIndex,
	index,
	testIdPrefix,
}: {
	entry: ContextMenuCheckboxDef;
	onDismiss: () => void;
	focusIndex: number;
	index: number;
	testIdPrefix: string | undefined;
}) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (focusIndex === index) ref.current?.focus();
	}, [focusIndex, index]);

	const handleClick = useCallback(() => {
		entry.onChange(!entry.checked);
		onDismiss();
	}, [entry, onDismiss]);

	return (
		<div
			ref={ref}
			role="menuitemcheckbox"
			aria-checked={entry.checked}
			tabIndex={focusIndex === index ? 0 : -1}
			className="menu-item"
			onClick={handleClick}
			data-testid={`${testIdPrefix ?? ""}ctx-item-${entry.id}`}
		>
			<span className="menu-item-icon">
				<ObsidianIcon icon={entry.checked ? "check-square" : "square"} />
			</span>
			<span className="menu-item-title">{entry.label}</span>
		</div>
	);
}

function SubmenuRow({
	entry,
	onDismiss,
	focusIndex,
	index,
	testIdPrefix,
}: {
	entry: ContextMenuSubmenuDef;
	onDismiss: () => void;
	focusIndex: number;
	index: number;
	testIdPrefix: string | undefined;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const subRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (focusIndex === index) ref.current?.focus();
	}, [focusIndex, index]);

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === "ArrowRight") {
			e.stopPropagation();
			setOpen(true);
		} else if (e.key === "ArrowLeft") {
			e.stopPropagation();
			setOpen(false);
			ref.current?.focus();
		}
	}, []);

	return (
		<div
			ref={ref}
			role="menuitem"
			aria-haspopup="true"
			aria-expanded={open}
			tabIndex={focusIndex === index ? 0 : -1}
			className="menu-item has-submenu"
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			onKeyDown={handleKeyDown}
			data-testid={`${testIdPrefix ?? ""}ctx-submenu-${entry.id}`}
		>
			<span className="menu-item-title">{entry.label}</span>
			<span className="menu-item-icon">
				<ObsidianIcon icon="chevron-right" />
			</span>
			{open && (
				<div ref={subRef} className="menu submenu" role="menu" style={{ position: "absolute", left: "100%", top: 0 }}>
					{entry.items.map((subEntry, subIdx) => (
						<MenuEntry
							key={subEntry.kind === "separator" ? `sep-${subIdx}` : (subEntry as { id: string }).id}
							entry={subEntry}
							onDismiss={onDismiss}
							focusIndex={-1}
							index={subIdx}
							testIdPrefix={testIdPrefix}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function MenuEntry({ entry, onDismiss, focusIndex, index, testIdPrefix }: MenuEntryProps) {
	switch (entry.kind) {
		case "separator":
			return <div className="menu-separator" role="separator" />;
		case "item":
			return (
				<MenuItemRow
					entry={entry}
					onDismiss={onDismiss}
					focusIndex={focusIndex}
					index={index}
					testIdPrefix={testIdPrefix}
				/>
			);
		case "checkbox":
			return (
				<MenuCheckboxRow
					entry={entry}
					onDismiss={onDismiss}
					focusIndex={focusIndex}
					index={index}
					testIdPrefix={testIdPrefix}
				/>
			);
		case "submenu":
			return (
				<SubmenuRow
					entry={entry}
					onDismiss={onDismiss}
					focusIndex={focusIndex}
					index={index}
					testIdPrefix={testIdPrefix}
				/>
			);
	}
}
