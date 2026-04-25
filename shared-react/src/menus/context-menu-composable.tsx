import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ObsidianIcon } from "../components/obsidian-icon";

interface ContextMenuRootState {
	open: boolean;
	position: { x: number; y: number };
	setOpen: (open: boolean, position?: { x: number; y: number }) => void;
}

const ContextMenuContext = createContext<ContextMenuRootState | null>(null);

function useContextMenuState(): ContextMenuRootState {
	const ctx = useContext(ContextMenuContext);
	if (!ctx) throw new Error("ContextMenu compound components must be used within ContextMenu.Root");
	return ctx;
}

export function ContextMenuRoot({ children }: { children: ReactNode }) {
	const [open, setOpenState] = useState(false);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	const setOpen = useCallback((newOpen: boolean, newPos?: { x: number; y: number }) => {
		if (newPos) setPosition(newPos);
		setOpenState(newOpen);
	}, []);

	const state = useMemo(() => ({ open, position, setOpen }), [open, position, setOpen]);

	return <ContextMenuContext value={state}>{children}</ContextMenuContext>;
}

export function ContextMenuTrigger({ children }: { children: ReactNode }) {
	const { setOpen } = useContextMenuState();

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setOpen(true, { x: e.clientX, y: e.clientY });
		},
		[setOpen]
	);

	return <div onContextMenu={handleContextMenu}>{children}</div>;
}

export function ContextMenuContent({ children }: { children: ReactNode }) {
	const { open, position, setOpen } = useContextMenuState();
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open, setOpen]);

	if (!open) return null;

	return createPortal(
		<div
			ref={menuRef}
			className="menu"
			role="menu"
			style={{ position: "fixed", left: position.x, top: position.y, zIndex: 1000 }}
		>
			{children}
		</div>,
		document.body
	);
}

export function ContextMenuItem({
	children,
	onSelect,
	disabled,
}: {
	children: ReactNode;
	onSelect?: () => void;
	disabled?: boolean;
}) {
	const { setOpen } = useContextMenuState();

	const handleClick = useCallback(() => {
		if (disabled) return;
		onSelect?.();
		setOpen(false);
	}, [disabled, onSelect, setOpen]);

	return (
		<div role="menuitem" className={`menu-item${disabled ? " is-disabled" : ""}`} onClick={handleClick}>
			<span className="menu-item-title">{children}</span>
		</div>
	);
}

export function ContextMenuSeparator() {
	return <div className="menu-separator" role="separator" />;
}

export function ContextMenuSub({ children }: { children: ReactNode }) {
	return (
		<div className="has-submenu" style={{ position: "relative" }}>
			{children}
		</div>
	);
}

export function ContextMenuSubTrigger({ children }: { children: ReactNode }) {
	return (
		<div role="menuitem" className="menu-item">
			<span className="menu-item-title">{children}</span>
			<span className="menu-item-icon">
				<ObsidianIcon icon="chevron-right" />
			</span>
		</div>
	);
}

export function ContextMenuSubContent({ children }: { children: ReactNode }) {
	return (
		<div className="menu submenu" role="menu" style={{ position: "absolute", left: "100%", top: 0 }}>
			{children}
		</div>
	);
}
