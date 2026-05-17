import type { DragEvent, ReactNode } from "react";
import { memo, useCallback, useState } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { cx } from "../../utils/cx";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { buildManagerRowStyles } from "./manager-row.styles";

export interface EditableItem {
	id: string;
	label: string;
	icon: string;
	color?: string;
}

export interface ManagerRowAction {
	icon: string;
	onClick: () => void;
	label: string;
	disabled?: boolean;
	testId?: string | undefined;
}

export interface ManagerRowProps {
	item: EditableItem;
	chip?: ReactNode;
	actions?: ManagerRowAction[];
	isVisible?: boolean;
	isExpanded?: boolean;
	onEdit?: () => void;
	onToggleVisibility?: () => void;
	visibleCount?: number;
	displayLabel?: string;
	displayIcon?: string;
	displayColor?: string;
	hasRename?: boolean;
	/**
	 * Sub-namespace for class names and testids — `"manager"` produces
	 * `prisma-manager-row`. Override per-instance (the tab manager uses
	 * `"tab-manager"`); defaults to `"manager"`.
	 */
	rowPrefix?: string;
	children?: ReactNode;
	/** When true, renders the grip column and wires drag-and-drop handlers. */
	draggable?: boolean;
	/** Visual state when this row is the dragged source. */
	isDragging?: boolean;
	/** Renders the up-arrow when provided; omit to hide. */
	onMoveUp?: () => void;
	/** Renders the down-arrow when provided; omit to hide. */
	onMoveDown?: () => void;
	onDragStart?: () => void;
	onDragEnd?: () => void;
	onDrop?: () => void;
}

export const ManagerRow = memo(function ManagerRow({
	item,
	chip,
	actions,
	isVisible = true,
	isExpanded = false,
	onEdit,
	onToggleVisibility,
	visibleCount = 1,
	displayLabel,
	displayIcon,
	displayColor,
	hasRename = false,
	rowPrefix = "manager",
	children,
	draggable = false,
	isDragging = false,
	onMoveUp,
	onMoveDown,
	onDragStart,
	onDragEnd,
	onDrop,
}: ManagerRowProps) {
	const { cls, tid, cssPrefix } = useScoped(rowPrefix);
	useInjectedStyles(`${cssPrefix}${rowPrefix}-row-styles`, buildManagerRowStyles(cssPrefix, rowPrefix));
	const [dragOver, setDragOver] = useState(false);

	const label = displayLabel ?? item.label;
	const icon = displayIcon ?? item.icon;
	const color = displayColor ?? item.color;

	const handleEdit = useCallback(() => onEdit?.(), [onEdit]);
	const handleToggle = useCallback(() => onToggleVisibility?.(), [onToggleVisibility]);

	const dragHandlers = draggable
		? {
				onDragStart: (e: DragEvent<HTMLDivElement>) => {
					onDragStart?.();
					e.dataTransfer.effectAllowed = "move";
				},
				onDragEnd: () => onDragEnd?.(),
				onDragOver: (e: DragEvent<HTMLDivElement>) => {
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					setDragOver(true);
				},
				onDragLeave: () => setDragOver(false),
				onDrop: (e: DragEvent<HTMLDivElement>) => {
					e.preventDefault();
					setDragOver(false);
					onDrop?.();
				},
			}
		: {};

	const showArrows = onMoveUp !== undefined || onMoveDown !== undefined;

	return (
		<div
			className={cx(
				cls("row"),
				!isVisible && cls("row-hidden"),
				isDragging && cls("row-dragging"),
				dragOver && cls("row-dragover")
			)}
			data-testid={tid("row", item.id)}
			data-row-id={item.id}
			draggable={draggable}
			{...dragHandlers}
		>
			{chip}

			{draggable && (
				<div className={cls("drag")}>
					<span className={cls("grip")}>
						<ObsidianIcon icon="grip-vertical" />
					</span>
				</div>
			)}

			{showArrows && (
				<div className={cls("arrows")}>
					{onMoveUp && (
						<button
							type="button"
							className={cls("drag-btn")}
							onClick={onMoveUp}
							data-testid={tid("up", item.id)}
							aria-label="Move up"
						>
							<ObsidianIcon icon="chevron-up" />
						</button>
					)}
					{onMoveDown && (
						<button
							type="button"
							className={cls("drag-btn")}
							onClick={onMoveDown}
							data-testid={tid("down", item.id)}
							aria-label="Move down"
						>
							<ObsidianIcon icon="chevron-down" />
						</button>
					)}
				</div>
			)}

			<div className={cls("label")}>
				<span className={cls("icon")} style={color && color !== "#000000" ? { color } : undefined}>
					<ObsidianIcon icon={icon} />
				</span>
				<span className={cls("label-text")}>{label}</span>
				{hasRename && (
					<span className={cls("label-original")} title="Original name">
						{item.label}
					</span>
				)}
			</div>

			<div className={cls("controls")}>
				{actions?.map((action) => (
					<button
						key={action.label}
						type="button"
						className={cls("btn")}
						onClick={action.onClick}
						disabled={action.disabled}
						title={action.label}
						data-testid={action.testId}
					>
						<ObsidianIcon icon={action.icon} />
					</button>
				))}

				{onEdit && (
					<button
						type="button"
						className={cls("btn")}
						onClick={handleEdit}
						title={isExpanded ? "Collapse" : "Edit"}
						data-testid={tid("edit", item.id)}
					>
						<ObsidianIcon icon={isExpanded ? "chevron-up" : "pencil"} />
					</button>
				)}

				{onToggleVisibility && (
					<button
						type="button"
						className={cls("btn")}
						onClick={handleToggle}
						disabled={isVisible && visibleCount <= 1}
						title={isVisible ? "Hide" : "Show"}
						data-testid={tid("toggle", item.id)}
					>
						<ObsidianIcon icon={isVisible ? "eye" : "eye-off"} />
					</button>
				)}
			</div>

			{children}
		</div>
	);
});
