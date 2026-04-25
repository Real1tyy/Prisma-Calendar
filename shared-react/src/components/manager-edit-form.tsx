import { memo, useCallback, useState } from "react";

import { useInjectedStyles } from "../hooks/use-injected-styles";
import { ObsidianIcon } from "./obsidian-icon";
import { TextInput } from "./setting-controls";
import { SettingItem } from "./setting-item";

function buildManagerEditFormStyles(p: string, fp: string): string {
	return `
.${p}${fp}-edit-form {
	width: 100%; padding: 8px 0 0 26px;
	border-top: 1px solid var(--background-modifier-border); margin-top: 6px;
}
`;
}

export interface EditableItem {
	id: string;
	label: string;
	icon: string;
	color?: string;
}

export interface ManagerEditFormProps {
	item: EditableItem;
	currentLabel: string;
	currentIcon: string;
	currentColor: string;
	hasRenameOverride?: boolean;
	hasIconOverride?: boolean;
	hasColorOverride?: boolean;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	onPickIcon?: (callback: (icon: string) => void) => void;
	cssPrefix?: string | undefined;
	formPrefix?: string;
}

export const ManagerEditForm = memo(function ManagerEditForm({
	item,
	currentLabel,
	currentIcon,
	currentColor,
	hasRenameOverride = false,
	hasIconOverride = false,
	hasColorOverride = false,
	onRename,
	onIconChange,
	onColorChange,
	onPickIcon,
	cssPrefix = "",
	formPrefix = "manager",
}: ManagerEditFormProps) {
	useInjectedStyles(`${cssPrefix}${formPrefix}-edit-form-styles`, buildManagerEditFormStyles(cssPrefix, formPrefix));
	const [labelValue, setLabelValue] = useState(currentLabel);

	const handleLabelChange = useCallback(
		(value: string) => {
			setLabelValue(value);
			const trimmed = value.trim();
			const resolved = trimmed && trimmed !== item.label ? trimmed : undefined;
			onRename(item.id, resolved);
		},
		[item.id, item.label, onRename]
	);

	const handleResetLabel = useCallback(() => {
		onRename(item.id, undefined);
		setLabelValue(item.label);
	}, [item.id, item.label, onRename]);

	const handleResetIcon = useCallback(() => {
		onIconChange(item.id, undefined);
	}, [item.id, onIconChange]);

	const handleResetColor = useCallback(() => {
		onColorChange(item.id, undefined);
	}, [item.id, onColorChange]);

	const handleIconClick = useCallback(() => {
		onPickIcon?.((icon) => {
			const resolved = icon !== item.icon ? icon : undefined;
			onIconChange(item.id, resolved);
		});
	}, [item.id, item.icon, onPickIcon, onIconChange]);

	const handleColorChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const defaultColor = item.color ?? "#ffffff";
			const resolved = e.target.value !== defaultColor ? e.target.value : undefined;
			onColorChange(item.id, resolved);
		},
		[item.id, item.color, onColorChange]
	);

	return (
		<div
			className={`${cssPrefix}${formPrefix}-edit-form`}
			data-testid={`${cssPrefix}${formPrefix}-edit-form-${item.id}`}
		>
			<SettingItem name="Name">
				<TextInput
					value={labelValue}
					onChange={handleLabelChange}
					placeholder={item.label}
					testId={`${cssPrefix}${formPrefix}-name-input-${item.id}`}
				/>
				{hasRenameOverride && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetLabel}
						title={`Reset to "${item.label}"`}
						data-testid={`${cssPrefix}${formPrefix}-name-reset-${item.id}`}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>

			<SettingItem name="Icon">
				<button type="button" onClick={handleIconClick} data-testid={`${cssPrefix}${formPrefix}-icon-btn-${item.id}`}>
					{currentIcon}
				</button>
				{hasIconOverride && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetIcon}
						title={`Reset to "${item.icon}"`}
						data-testid={`${cssPrefix}${formPrefix}-icon-reset-${item.id}`}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>

			<SettingItem name="Color">
				<input
					type="color"
					value={currentColor}
					onChange={handleColorChange}
					data-testid={`${cssPrefix}${formPrefix}-color-input-${item.id}`}
				/>
				{hasColorOverride && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetColor}
						title="Reset to default color"
						data-testid={`${cssPrefix}${formPrefix}-color-reset-${item.id}`}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>
		</div>
	);
});
