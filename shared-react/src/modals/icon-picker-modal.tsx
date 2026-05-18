import type { App } from "obsidian";

import { showReactModal } from "../show-react-modal";
import { IconPickerGrid } from "../widgets/icon-picker/icon-picker-grid";

export interface ShowReactIconPickerOptions {
	allowNoIcon?: boolean;
}

export function showReactIconPicker(
	app: App,
	onDone: (icon: string | null) => void,
	options?: ShowReactIconPickerOptions
): void {
	showReactModal({
		app,
		cls: "mod-shared-icon-picker",
		title: "Choose icon",
		render: (close) => (
			<IconPickerGrid
				allowNoIcon={options?.allowNoIcon ?? true}
				onSelect={(icon) => {
					onDone(icon);
					close();
				}}
			/>
		),
	});
}
