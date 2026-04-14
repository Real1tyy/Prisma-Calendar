import type { App } from "obsidian";
import { memo, useCallback, useContext } from "react";

import { showIconPicker } from "../../components/primitives/icon-picker";
import { AppContext } from "../contexts/app-context";
import { ObsidianIcon } from "./obsidian-icon";

/**
 * Imperatively opens the icon picker. Thin wrapper over the existing
 * `showIconPicker` function — exposed as a hook so callers don't re-plumb
 * `App` themselves. Pass an explicit `app` to bypass `AppContext`.
 */
export function useIconPicker(app?: App): (onDone: (icon: string) => void) => void {
	const fromContext = useContext(AppContext);
	const resolved = app ?? fromContext;

	return useCallback(
		(onDone: (icon: string) => void) => {
			if (!resolved) throw new Error("useIconPicker: no App available — wrap in <AppContext> or pass `app`.");
			showIconPicker(resolved, onDone);
		},
		[resolved]
	);
}

export interface IconPickerButtonProps {
	value: string;
	onChange: (icon: string) => void;
	/** Accessible label for the button. Defaults to "Pick icon". */
	ariaLabel?: string;
	className?: string;
	/** Explicit App instance — falls back to AppContext. */
	app?: App;
}

/**
 * Button that displays the current icon and opens the fuzzy icon picker on
 * click. Composes `ObsidianIcon` + `useIconPicker`.
 */
export const IconPickerButton = memo(function IconPickerButton({
	value,
	onChange,
	ariaLabel = "Pick icon",
	className,
	app,
}: IconPickerButtonProps) {
	const openPicker = useIconPicker(app);

	return (
		<button
			type="button"
			className={className ?? "clickable-icon"}
			aria-label={ariaLabel}
			onClick={() => openPicker(onChange)}
		>
			<ObsidianIcon icon={value} />
		</button>
	);
});
