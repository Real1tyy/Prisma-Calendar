import type { App } from "obsidian";
import { FuzzySuggestModal, getIconIds } from "obsidian";

export function showIconPicker(app: App, onDone: (icon: string) => void): void {
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
