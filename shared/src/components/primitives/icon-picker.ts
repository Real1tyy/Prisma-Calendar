import { FuzzySuggestModal, getIconIds, type App } from "obsidian";

export interface IconPickerOptions {
	allowNoIcon?: boolean;
}

export type IconPickerFn = (app: App, onDone: (icon: string | null) => void, options?: IconPickerOptions) => void;

let _override: IconPickerFn | null = null;

export function setIconPickerImplementation(impl: IconPickerFn): void {
	_override = impl;
}

export function showIconPicker(app: App, onDone: (icon: string | null) => void, options?: IconPickerOptions): void {
	if (_override) {
		_override(app, onDone, options);
		return;
	}

	class IconPickerModal extends FuzzySuggestModal<string> {
		getItems(): string[] {
			return getIconIds();
		}

		getItemText(item: string): string {
			return item;
		}

		onChooseItem(item: string): void {
			onDone(item);
		}
	}

	const modal = new IconPickerModal(app);
	modal.setPlaceholder("Choose an icon...");
	modal.open();
}
