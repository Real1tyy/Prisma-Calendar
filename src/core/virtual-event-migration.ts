import { normalizePath, TFile, type App } from "obsidian";

import { VIRTUAL_EVENTS_CODE_FENCE } from "../constants";
import type { SingleCalendarConfig } from "../types/settings";
import { log } from "./logging";

export async function transformLegacyVirtualEventsFiles(
	app: App,
	calendars: readonly SingleCalendarConfig[]
): Promise<void> {
	for (const calendar of calendars) {
		if (!calendar.directory) continue;
		const legacyPath = normalizePath(`${calendar.directory}/Virtual Events.md`);
		const legacyFile = app.vault.getAbstractFileByPath(legacyPath);
		if (!(legacyFile instanceof TFile)) continue;

		const targetPath = normalizePath(`${calendar.directory}/Prisma.md`);
		const targetFile = app.vault.getAbstractFileByPath(targetPath);

		if (!(targetFile instanceof TFile)) {
			await app.fileManager.renameFile(legacyFile, targetPath);
		} else {
			const legacyContent = await app.vault.read(legacyFile);
			const regex = new RegExp(
				`^\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}[^\\S\\r\\n]*\\r?\\n([\\s\\S]*?)^\`\`\`[^\\S\\r\\n]*(?=\\r?$)`,
				"m"
			);
			const match = legacyContent.match(regex);
			if (match?.[1]) {
				try {
					const legacyEvents = JSON.parse(match[1]);
					if (Array.isArray(legacyEvents) && legacyEvents.length > 0) {
						const targetContent = await app.vault.read(targetFile);
						const targetMatch = targetContent.match(regex);
						const existingEvents = targetMatch?.[1] ? JSON.parse(targetMatch[1]) : [];
						const existingIds = new Set(
							Array.isArray(existingEvents) ? existingEvents.map((e: { id?: string }) => e.id) : []
						);
						const merged = Array.isArray(existingEvents) ? [...existingEvents] : [];
						for (const ev of legacyEvents) {
							if (!existingIds.has(ev.id)) merged.push(ev);
						}
						const updatedContent = targetMatch
							? targetContent.replace(
									regex,
									`\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}\n${JSON.stringify(merged, null, 2)}\n\`\`\``
								)
							: `${targetContent.trimEnd()}\n\n\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}\n${JSON.stringify(merged, null, 2)}\n\`\`\`\n`;
						await app.vault.modify(targetFile, updatedContent);
					}
				} catch (error) {
					log.error("indexing", "Failed to parse legacy virtual events during migration", { error });
				}
			}
			await app.fileManager.trashFile(legacyFile);
		}
	}
}
