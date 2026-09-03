import { memo, useCallback, useState } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { ColorInput } from "../../primitives/controls/color-input";
import { TextInput } from "../../primitives/controls/text-input";
import { SettingItem } from "../../primitives/layout/setting-item";
import { buildManagerEditFormStyles } from "./manager-edit-form.styles";

/**
 * Icon override value meaning "render no icon at all" — a deliberate user choice,
 * distinct from `undefined` ("no override → fall back to the item's default icon").
 * The picker's "No icon" button resolves to this; the stores persist it verbatim.
 */
export const NO_ICON = "";

const FALLBACK_COLOR = "#ffffff";

export interface EditableItem {
	id: string;
	label: string;
	icon: string;
	/** Default icon color. */
	color?: string;
	/** Default label-text color. */
	textColor?: string;
}

export interface ManagerEditValues {
	label: string;
	icon: string;
	/** Current icon color. */
	color: string;
	/** Current label-text color. */
	textColor: string;
}

export interface ManagerEditOverrides {
	label: boolean;
	icon: boolean;
	color: boolean;
	textColor: boolean;
}

export interface ManagerEditActions {
	rename: (label: string | undefined) => void;
	changeIcon: (icon: string | undefined) => void;
	changeColor: (color: string | undefined) => void;
	changeTextColor: (color: string | undefined) => void;
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

	const handleResetTextColor = useCallback(() => {
		actions.changeTextColor(undefined);
	}, [actions]);

	const handleIconClick = useCallback(() => {
		actions.pickIcon?.((icon) => {
			// null = the user clicked "No icon" → persist an explicit empty override
			// (NO_ICON) so the icon is actually removed. Picking the item's default
			// icon clears the override instead, so we don't store a redundant one that
			// would pin the icon against future default changes.
			const resolved = icon === null ? NO_ICON : icon === item.icon ? undefined : icon;
			actions.changeIcon(resolved);
		});
	}, [item.icon, actions]);

	const handleColorChange = useCallback(
		(next: string) => {
			const defaultColor = item.color ?? FALLBACK_COLOR;
			const resolved = next !== defaultColor ? next : undefined;
			actions.changeColor(resolved);
		},
		[item.color, actions]
	);

	const handleTextColorChange = useCallback(
		(next: string) => {
			const defaultColor = item.textColor ?? FALLBACK_COLOR;
			const resolved = next !== defaultColor ? next : undefined;
			actions.changeTextColor(resolved);
		},
		[item.textColor, actions]
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
					{values.icon || "No icon"}
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

			<SettingItem name="Icon color">
				<ColorInput value={values.color} onChange={handleColorChange} testId={tid("color-input", item.id)} />
				{overrides.color && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetColor}
						title="Reset to default icon color"
						data-testid={tid("color-reset", item.id)}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>

			<SettingItem name="Text color">
				<ColorInput
					value={values.textColor}
					onChange={handleTextColorChange}
					testId={tid("text-color-input", item.id)}
				/>
				{overrides.textColor && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetTextColor}
						title="Reset to default text color"
						data-testid={tid("text-color-reset", item.id)}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>
		</div>
	);
});
