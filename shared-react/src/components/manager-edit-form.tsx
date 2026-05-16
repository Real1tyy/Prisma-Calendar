import { memo, useCallback, useState } from "react";

import { useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/styles/use-styles";
import { buildManagerEditFormStyles } from "./manager-edit-form.styles";
import { ObsidianIcon } from "./obsidian-icon";
import { ColorInput, TextInput } from "./setting-controls";
import { SettingItem } from "./setting-item";

export interface EditableItem {
	id: string;
	label: string;
	icon: string;
	color?: string;
}

export interface ManagerEditValues {
	label: string;
	icon: string;
	color: string;
}

export interface ManagerEditOverrides {
	label: boolean;
	icon: boolean;
	color: boolean;
}

export interface ManagerEditActions {
	rename: (label: string | undefined) => void;
	changeIcon: (icon: string | undefined) => void;
	changeColor: (color: string | undefined) => void;
	pickIcon?: (callback: (icon: string | null) => void) => void;
}

export interface ManagerEditController {
	item: EditableItem;
	values: ManagerEditValues;
	overrides: ManagerEditOverrides;
	actions: ManagerEditActions;
}

export interface ManagerEditFormProps {
	controller: ManagerEditController;
	formPrefix?: string;
}

export const ManagerEditForm = memo(function ManagerEditForm({
	controller,
	formPrefix = "manager",
}: ManagerEditFormProps) {
	const { item, values, overrides, actions } = controller;
	const { cls, tid, cssPrefix } = useScoped(formPrefix);
	useInjectedStyles(`${cssPrefix}${formPrefix}-edit-form-styles`, buildManagerEditFormStyles(cssPrefix, formPrefix));
	const [labelValue, setLabelValue] = useState(values.label);

	const handleLabelChange = useCallback(
		(value: string) => {
			setLabelValue(value);
			const trimmed = value.trim();
			const resolved = trimmed && trimmed !== item.label ? trimmed : undefined;
			actions.rename(resolved);
		},
		[item.label, actions]
	);

	const handleResetLabel = useCallback(() => {
		actions.rename(undefined);
		setLabelValue(item.label);
	}, [item.label, actions]);

	const handleResetIcon = useCallback(() => {
		actions.changeIcon(undefined);
	}, [actions]);

	const handleResetColor = useCallback(() => {
		actions.changeColor(undefined);
	}, [actions]);

	const handleIconClick = useCallback(() => {
		actions.pickIcon?.((icon) => {
			// null = the user clicked "No icon" in the picker → clear the override.
			// Picking the item's default icon also clears so we don't store a
			// redundant override that would prevent future default changes.
			const resolved = icon === null || icon === item.icon ? undefined : icon;
			actions.changeIcon(resolved);
		});
	}, [item.icon, actions]);

	const handleColorChange = useCallback(
		(next: string) => {
			const defaultColor = item.color ?? "#ffffff";
			const resolved = next !== defaultColor ? next : undefined;
			actions.changeColor(resolved);
		},
		[item.color, actions]
	);

	return (
		<div className={cls("edit-form")} data-testid={tid("edit-form", item.id)}>
			<SettingItem name="Name">
				<TextInput
					value={labelValue}
					onChange={handleLabelChange}
					placeholder={item.label}
					testId={tid("name-input", item.id)}
				/>
				{overrides.label && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetLabel}
						title={`Reset to "${item.label}"`}
						data-testid={tid("name-reset", item.id)}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>

			<SettingItem name="Icon">
				<button type="button" onClick={handleIconClick} data-testid={tid("icon-btn", item.id)}>
					{values.icon}
				</button>
				{overrides.icon && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetIcon}
						title={`Reset to "${item.icon}"`}
						data-testid={tid("icon-reset", item.id)}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>

			<SettingItem name="Color">
				<ColorInput value={values.color} onChange={handleColorChange} testId={tid("color-input", item.id)} />
				{overrides.color && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetColor}
						title="Reset to default color"
						data-testid={tid("color-reset", item.id)}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>
		</div>
	);
});
