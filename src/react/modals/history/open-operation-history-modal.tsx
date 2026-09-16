import { showReactModal } from "@real1ty/obsidian-plugins-react";
import { Notice } from "obsidian";

import { CSS_PREFIX } from "../../../constants";
import { resolveActiveHistoryBundle } from "../../../core/api/read-operations";
import type CustomCalendarPlugin from "../../../main";
import { OperationHistoryContent } from "./operation-history-content";

export function openOperationHistoryModal(plugin: CustomCalendarPlugin): void {
	const bundle = resolveActiveHistoryBundle(plugin);
	if (!bundle) {
		new Notice("Prisma Calendar: no calendar is open");
		return;
	}

	showReactModal({
		app: plugin.app,
		cssPrefix: CSS_PREFIX,
		testIdPrefix: CSS_PREFIX,
		cls: "prisma-history-modal-shell",
		title: "Operation history",
		render: () => (
			<OperationHistoryContent
				manager={bundle.commandManager}
				calendarName={bundle.settingsStore.currentSettings.name}
			/>
		),
	});
}
