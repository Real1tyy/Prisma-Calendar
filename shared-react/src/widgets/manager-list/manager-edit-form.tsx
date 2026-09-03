import { memo, useCallback, useState } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { ColorInput } from "../../primitives/controls/color-input";
import { TextInput } from "../../primitives/controls/text-input";
import { SettingItem } from "../../primitives/layout/setting-item";
import type { Appearance, AppearanceAxis, AppearanceColorAxis, AppearanceOverridden } from "../../utils/appearance";
import { buildManagerEditFormStyles } from "./manager-edit-form.styles";

/**
 * Icon override value meaning "render no icon at all" — a deliberate user choice,
 * distinct from `undefined` ("no override → fall back to the item's default icon").
 * The picker's "No icon" button resolves to this; the stores persist it verbatim.
 */
export const NO_ICON = "";

/** Shown by the picker when the item itself declares no colour for that axis. */
const FALLBACK_COLOR = "#ffffff";

/**
 * One colour row of the form. Adding an axis to
 * {@link import("../../utils/appearance").APPEARANCE_COLOR_AXES} and a line here is
 * the entire UI change — the control, its reset button, and their testids follow.
 */
interface ColorControlSpec {
	axis: AppearanceColorAxis;
	name: string;
	/** Testid stem: `<stem>-input` / `<stem>-reset`. */
	stem: string;
	resetTitle: string;
}

const COLOR_CONTROLS: readonly ColorControlSpec[] = [
	{ axis: "color", name: "Icon color", stem: "color", resetTitle: "Reset to default icon color" },
	{ axis: "textColor", name: "Text color", stem: "text-color", resetTitle: "Reset to default text color" },
	{
		axis: "backgroundColor",
		name: "Background color",
		stem: "background-color",
		resetTitle: "Reset to default background color",
	},
];

export interface ManagerEditItem {
	id: string;
	/** The label as defined — the reset target and the input's placeholder. */
	label: string;
	/** The appearance as defined, before any override — the reset targets. */
	appearance: Appearance;
}

export interface ManagerEditActions {
	rename: (label: string | undefined) => void;
	/** `undefined` clears the axis back to the item's own default. */
	setAppearance: (axis: AppearanceAxis, value: string | undefined) => void;
	pickIcon?: (callback: (icon: string | null) => void) => void;
}

export interface ManagerEditController {
	item: ManagerEditItem;
	/** What the form shows: the resolved label and appearance, overrides applied. */
	label: string;
	appearance: Appearance;
	overridden: { label: boolean; appearance: AppearanceOverridden };
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
	const { item, label, appearance, overridden, actions } = controller;
	const { cls, tid, cssPrefix } = useScoped(formPrefix);
	useInjectedStyles(`${cssPrefix}${formPrefix}-edit-form-styles`, buildManagerEditFormStyles(cssPrefix, formPrefix));
	const [labelValue, setLabelValue] = useState(label);

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
		actions.setAppearance("icon", undefined);
	}, [actions]);

	const defaultIcon = item.appearance.icon ?? "";
	const handleIconClick = useCallback(() => {
		actions.pickIcon?.((icon) => {
			// null = the user clicked "No icon" → persist an explicit empty override
			// (NO_ICON) so the icon is actually removed. Picking the item's default
			// icon clears the override instead, so we don't store a redundant one that
			// would pin the icon against future default changes.
			const resolved = icon === null ? NO_ICON : icon === defaultIcon ? undefined : icon;
			actions.setAppearance("icon", resolved);
		});
	}, [defaultIcon, actions]);

	return (
		<div className={cls("edit-form")} data-testid={tid("edit-form", item.id)}>
			<SettingItem name="Name">
				<TextInput
					value={labelValue}
					onChange={handleLabelChange}
					placeholder={item.label}
					testId={tid("name-input", item.id)}
				/>
				{overridden.label && (
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
					{appearance.icon || "No icon"}
				</button>
				{overridden.appearance.icon && (
					<button
						type="button"
						className="clickable-icon"
						onClick={handleResetIcon}
						title={`Reset to "${defaultIcon}"`}
						data-testid={tid("icon-reset", item.id)}
					>
						<ObsidianIcon icon="rotate-ccw" />
					</button>
				)}
			</SettingItem>

			{COLOR_CONTROLS.map((control) => (
				<ColorControl
					key={control.axis}
					control={control}
					itemId={item.id}
					value={appearance[control.axis] ?? FALLBACK_COLOR}
					defaultValue={item.appearance[control.axis] ?? FALLBACK_COLOR}
					isOverridden={overridden.appearance[control.axis]}
					setAppearance={actions.setAppearance}
					formPrefix={formPrefix}
				/>
			))}
		</div>
	);
});

interface ColorControlProps {
	control: ColorControlSpec;
	itemId: string;
	value: string;
	defaultValue: string;
	isOverridden: boolean;
	setAppearance: ManagerEditActions["setAppearance"];
	formPrefix: string;
}

const ColorControl = memo(function ColorControl({
	control,
	itemId,
	value,
	defaultValue,
	isOverridden,
	setAppearance,
	formPrefix,
}: ColorControlProps) {
	const { tid } = useScoped(formPrefix);
	const { axis, name, stem, resetTitle } = control;

	// Picking the item's own colour is not an override — storing it would pin the
	// value against a future change to that default.
	const handleChange = useCallback(
		(next: string) => setAppearance(axis, next !== defaultValue ? next : undefined),
		[axis, defaultValue, setAppearance]
	);

	const handleReset = useCallback(() => setAppearance(axis, undefined), [axis, setAppearance]);

	return (
		<SettingItem name={name}>
			<ColorInput value={value} onChange={handleChange} testId={tid(`${stem}-input`, itemId)} />
			{isOverridden && (
				<button
					type="button"
					className="clickable-icon"
					onClick={handleReset}
					title={resetTitle}
					data-testid={tid(`${stem}-reset`, itemId)}
				>
					<ObsidianIcon icon="rotate-ccw" />
				</button>
			)}
		</SettingItem>
	);
});
