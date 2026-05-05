import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { ObsidianIcon } from "../components/obsidian-icon";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { cx } from "../utils/cx";
import { buildTabbedContainerStyles } from "./tabbed-container.styles";

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
	return (
		<button
			type="button"
			role="tab"
			aria-selected={isActive}
			className={cx(`${cssPrefix}tab`, isActive && `${cssPrefix}tab-active`)}
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
			e.dataTransfer.effectAllowed = "move";
		},
		[]
	);

	const handleDragOver = useCallback(
		(_id: string) => (e: React.DragEvent) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
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
							className={cx(`${cssPrefix}tab-panel`, !isActive && `${cssPrefix}tab-panel-hidden`)}
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
