import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { ObsidianIcon } from "../components/obsidian-icon";
import { useInjectedStyles } from "../hooks/use-injected-styles";

function buildTabbedContainerStyles(p: string): string {
	return `
.${p}tabbed-container { display: flex; flex-direction: column; height: 100%; }
.${p}tab-bar {
	display: flex; align-items: center; gap: 2px; padding: 2px; margin: 0 4px;
	border-radius: 8px; background: var(--background-modifier-hover); flex-shrink: 0;
}
.${p}tab {
	padding: 4px 12px; font-size: var(--font-ui-smaller); font-weight: 500;
	color: var(--text-muted); background: none; border: none; border-radius: 6px;
	cursor: pointer; box-shadow: none; white-space: nowrap; line-height: 1.4;
	transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}
.${p}tab:hover { color: var(--text-normal); background: hsla(var(--color-accent-hsl), 0.08); }
.${p}tab-active {
	color: var(--text-on-accent); background: var(--interactive-accent);
	font-weight: 600; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.${p}tab-active:hover { color: var(--text-on-accent); background: var(--interactive-accent-hover); }
.${p}tab-icon { display: inline-flex; align-items: center; margin-right: 4px; }
.${p}tab-icon svg { width: 14px; height: 14px; }
.${p}tab-close {
	display: inline-flex; align-items: center; margin-left: 6px; padding: 2px;
	border-radius: 4px; cursor: pointer; color: var(--text-faint);
	transition: color 100ms ease, background 100ms ease;
}
.${p}tab-close:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
.${p}tab-close svg { width: 12px; height: 12px; }
.${p}tab-content { flex: 1; overflow-y: auto; min-height: 0; }
.${p}tab-panel { padding: 0; height: 100%; }
.${p}tab-panel-hidden { display: none; }
`;
}

export interface ReactTabDefinition {
	id: string;
	label: string;
	icon?: string | undefined;
	closable?: boolean | undefined;
	reorderable?: boolean | undefined;
}

export interface TabbedContainerProps {
	tabs: ReactTabDefinition[];
	activeId: string;
	onChange: (id: string) => void;
	onClose?: ((id: string) => void) | undefined;
	onReorder?: ((fromIndex: number, toIndex: number) => void) | undefined;
	onRename?: ((id: string, newLabel: string) => void) | undefined;
	renderContent: (tab: ReactTabDefinition) => ReactNode;
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
}

// ─── Tab Button ───

interface TabButtonProps {
	tab: ReactTabDefinition;
	isActive: boolean;
	onClick: () => void;
	onClose?: (() => void) | undefined;
	onDragStart?: ((e: React.DragEvent) => void) | undefined;
	onDragOver?: ((e: React.DragEvent) => void) | undefined;
	onDragLeave?: ((e: React.DragEvent) => void) | undefined;
	onDrop?: ((e: React.DragEvent) => void) | undefined;
	onDragEnd?: ((e: React.DragEvent) => void) | undefined;
	draggable?: boolean | undefined;
	cssPrefix: string;
	testIdPrefix?: string | undefined;
}

const TabButton = memo(function TabButton({
	tab,
	isActive,
	onClick,
	onClose,
	onDragStart,
	onDragOver,
	onDragLeave,
	onDrop,
	onDragEnd,
	draggable = false,
	cssPrefix,
	testIdPrefix,
}: TabButtonProps) {
	const className = [`${cssPrefix}tab`, isActive ? `${cssPrefix}tab-active` : ""].filter(Boolean).join(" ");

	return (
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			className={className}
			onClick={onClick}
			draggable={draggable}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			data-tab-id={tab.id}
			data-testid={`${testIdPrefix ?? cssPrefix}tab-${tab.id}`}
		>
			{tab.icon && (
				<span className={`${cssPrefix}tab-icon`}>
					<ObsidianIcon icon={tab.icon} />
				</span>
			)}
			{tab.label}
			{onClose && tab.closable && (
				<span
					className={`${cssPrefix}tab-close`}
					role="button"
					aria-label={`Close ${tab.label}`}
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					data-testid={`${testIdPrefix ?? cssPrefix}tab-close-${tab.id}`}
				>
					<ObsidianIcon icon="x" />
				</span>
			)}
		</button>
	);
});

// ─── TabbedContainer ───

export const TabbedContainer = memo(function TabbedContainer({
	tabs,
	activeId,
	onChange,
	onClose,
	onReorder,
	onRename: _onRename,
	renderContent,
	cssPrefix = "",
	testIdPrefix,
}: TabbedContainerProps) {
	useInjectedStyles(`${cssPrefix}tabbed-container-styles`, buildTabbedContainerStyles(cssPrefix));
	const [draggedId, setDraggedId] = useState<string | null>(null);
	const renderedRef = useRef(new Set<string>());

	useEffect(() => {
		if (activeId) {
			renderedRef.current.add(activeId);
		}
	}, [activeId]);

	const handleDragStart = useCallback(
		(id: string) => (e: React.DragEvent) => {
			setDraggedId(id);
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		},
		[]
	);

	const handleDragOver = useCallback(
		(_id: string) => (e: React.DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		},
		[]
	);

	const handleDragLeave = useCallback(() => {}, []);

	const handleDrop = useCallback(
		(id: string) => (e: React.DragEvent) => {
			e.preventDefault();
			if (!draggedId || draggedId === id || !onReorder) return;
			const fromIndex = tabs.findIndex((t) => t.id === draggedId);
			const toIndex = tabs.findIndex((t) => t.id === id);
			if (fromIndex >= 0 && toIndex >= 0) {
				onReorder(fromIndex, toIndex);
			}
		},
		[draggedId, onReorder, tabs]
	);

	const handleDragEnd = useCallback(() => {
		setDraggedId(null);
	}, []);

	return (
		<div className={`${cssPrefix}tabbed-container`}>
			<div className={`${cssPrefix}tab-bar`} role="tablist">
				{tabs.map((tab) => (
					<TabButton
						key={tab.id}
						tab={tab}
						isActive={tab.id === activeId}
						onClick={() => onChange(tab.id)}
						onClose={onClose ? () => onClose(tab.id) : undefined}
						draggable={!!onReorder && tab.reorderable !== false}
						onDragStart={onReorder ? handleDragStart(tab.id) : undefined}
						onDragOver={onReorder ? handleDragOver(tab.id) : undefined}
						onDragLeave={onReorder ? handleDragLeave : undefined}
						onDrop={onReorder ? handleDrop(tab.id) : undefined}
						onDragEnd={onReorder ? handleDragEnd : undefined}
						cssPrefix={cssPrefix}
						testIdPrefix={testIdPrefix}
					/>
				))}
			</div>
			<div className={`${cssPrefix}tab-content`}>
				{tabs.map((tab) => {
					const isActive = tab.id === activeId;
					const wasRendered = renderedRef.current.has(tab.id);
					if (!isActive && !wasRendered) return null;

					return (
						<div
							key={tab.id}
							role="tabpanel"
							className={`${cssPrefix}tab-panel${!isActive ? ` ${cssPrefix}tab-panel-hidden` : ""}`}
							data-tab-id={tab.id}
							data-testid={`${testIdPrefix ?? cssPrefix}tab-content-${tab.id}`}
						>
							{renderContent(tab)}
						</div>
					);
				})}
			</div>
		</div>
	);
});
