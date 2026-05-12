import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { cx } from "../utils/cx";
import { buildManagerRowStyles } from "./manager-row.styles";
import { ObsidianIcon } from "./obsidian-icon";

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
}: ManagerRowProps) {
	const { cls, tid, cssPrefix } = useScoped(rowPrefix);
	useInjectedStyles(`${cssPrefix}${rowPrefix}-row-styles`, buildManagerRowStyles(cssPrefix, rowPrefix));
	const label = displayLabel ?? item.label;
	const icon = displayIcon ?? item.icon;
	const color = displayColor ?? item.color;

	const handleEdit = useCallback(() => onEdit?.(), [onEdit]);
	const handleToggle = useCallback(() => onToggleVisibility?.(), [onToggleVisibility]);

	return (
		<div className={cx(cls("row"), !isVisible && cls("row-hidden"))} data-testid={tid("row", item.id)}>
			{chip}
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
