import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { useInjectedStyles } from "../hooks/use-injected-styles";
import { ObsidianIcon } from "./obsidian-icon";

function buildManagerRowStyles(p: string, rp: string): string {
	return `
.${p}${rp}-row {
	display: flex; align-items: center; gap: 6px; padding: 8px 10px;
	background: var(--background-secondary); border: 1px solid var(--background-modifier-border);
	border-radius: 8px; transition: opacity 150ms ease, border-color 150ms ease, background 150ms ease;
	flex-wrap: wrap;
}
.${p}${rp}-row[draggable="true"] { cursor: grab; }
.${p}${rp}-row-hidden { opacity: 0.5; }
.${p}${rp}-label { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.${p}${rp}-icon { display: flex; align-items: center; flex-shrink: 0; }
.${p}${rp}-icon svg { width: 16px; height: 16px; }
.${p}${rp}-label-text {
	font-size: var(--font-ui-medium); font-weight: 500; color: var(--text-normal);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${p}${rp}-label-original { font-size: 0.7em; color: var(--text-faint); font-style: italic; white-space: nowrap; }
.${p}${rp}-controls { display: flex; gap: 4px; flex-shrink: 0; }
.${p}${rp}-btn {
	display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
	background: none; border: 1px solid transparent; border-radius: 6px;
	color: var(--text-faint); cursor: pointer; padding: 0; box-shadow: none;
	transition: color 120ms ease, border-color 120ms ease;
}
.${p}${rp}-btn:hover:not([disabled]) { color: var(--text-normal); border-color: var(--background-modifier-border); }
.${p}${rp}-btn[disabled] { opacity: 0.3; cursor: not-allowed; }
.${p}${rp}-btn svg { width: 14px; height: 14px; }
`;
}

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
	testId?: string;
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
	cssPrefix?: string | undefined;
	testIdPrefix?: string;
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
	cssPrefix = "",
	testIdPrefix,
	rowPrefix = "manager",
	children,
}: ManagerRowProps) {
	useInjectedStyles(`${cssPrefix}${rowPrefix}-row-styles`, buildManagerRowStyles(cssPrefix, rowPrefix));
	const label = displayLabel ?? item.label;
	const icon = displayIcon ?? item.icon;
	const color = displayColor ?? item.color;

	const handleEdit = useCallback(() => onEdit?.(), [onEdit]);
	const handleToggle = useCallback(() => onToggleVisibility?.(), [onToggleVisibility]);

	return (
		<div
			className={`${cssPrefix}${rowPrefix}-row${!isVisible ? ` ${cssPrefix}${rowPrefix}-row-hidden` : ""}`}
			data-testid={testIdPrefix ? `${testIdPrefix}${rowPrefix}-row-${item.id}` : undefined}
		>
			{chip}
			<div className={`${cssPrefix}${rowPrefix}-label`}>
				<span className={`${cssPrefix}${rowPrefix}-icon`} style={color && color !== "#000000" ? { color } : undefined}>
					<ObsidianIcon icon={icon} />
				</span>
				<span className={`${cssPrefix}${rowPrefix}-label-text`}>{label}</span>
				{hasRename && (
					<span className={`${cssPrefix}${rowPrefix}-label-original`} title="Original name">
						{item.label}
					</span>
				)}
			</div>

			<div className={`${cssPrefix}${rowPrefix}-controls`}>
				{actions?.map((action) => (
					<button
						key={action.label}
						type="button"
						className={`${cssPrefix}${rowPrefix}-btn`}
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
						className={`${cssPrefix}${rowPrefix}-btn`}
						onClick={handleEdit}
						title={isExpanded ? "Collapse" : "Edit"}
						data-testid={testIdPrefix ? `${testIdPrefix}${rowPrefix}-edit-${item.id}` : undefined}
					>
						<ObsidianIcon icon={isExpanded ? "chevron-up" : "pencil"} />
					</button>
				)}

				{onToggleVisibility && (
					<button
						type="button"
						className={`${cssPrefix}${rowPrefix}-btn`}
						onClick={handleToggle}
						disabled={isVisible && visibleCount <= 1}
						title={isVisible ? "Hide" : "Show"}
						data-testid={testIdPrefix ? `${testIdPrefix}${rowPrefix}-toggle-${item.id}` : undefined}
					>
						<ObsidianIcon icon={isVisible ? "eye" : "eye-off"} />
					</button>
				)}
			</div>

			{children}
		</div>
	);
});
