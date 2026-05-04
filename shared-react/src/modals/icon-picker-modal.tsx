import type { App } from "obsidian";

import { IconPickerGrid } from "../components/icon-picker-grid";
import { showReactModal } from "../show-react-modal";

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
