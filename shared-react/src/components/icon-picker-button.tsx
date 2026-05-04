import type { App } from "obsidian";
import { memo, useCallback, useContext } from "react";

import { AppContext } from "../contexts/app-context";
import { showReactIconPicker } from "../modals/icon-picker-modal";
import { ObsidianIcon } from "./obsidian-icon";

export function useIconPicker(app?: App): (onDone: (icon: string | null) => void) => void {
	const fromContext = useContext(AppContext);
	const resolved = app ?? fromContext;

	return useCallback(
		(onDone: (icon: string | null) => void) => {
			if (!resolved) throw new Error("useIconPicker: no App available — wrap in <AppContext> or pass `app`.");
			showReactIconPicker(resolved, onDone);
		},
		[resolved]
	);
}

export interface IconPickerButtonProps {
	value: string;
	onChange: (icon: string | null) => void;
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
