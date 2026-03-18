import { showConfirmationModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

export function showConfirmDeleteModal(app: App, entityName: string, entityType: string, onConfirm: () => void): void {
	showConfirmationModal(app, {
		title: `Delete ${entityType}`,
		message: `Are you sure you want to delete the ${entityType} "${entityName}"?`,
		confirmButton: { text: "Delete", warning: true },
		cancelButton: "Cancel",
		onConfirm,
	});
}
