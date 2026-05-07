import { openConfirmation } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";

export function showConfirmDeleteModal(app: App, entityName: string, entityType: string, onConfirm: () => void): void {
	void openConfirmation(app, {
		title: `Delete ${entityType}`,
		message: `Are you sure you want to delete the ${entityType} "${entityName}"?`,
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		destructive: true,
		onConfirm,
	});
}
