import type { Command } from "@real1ty-obsidian-plugins";
import { ensureISOSuffix, parseFrontmatterRecord, parseIntoList, toDisplayLink } from "@real1ty-obsidian-plugins";
import type { DurationLike } from "luxon";

import type { Frontmatter } from "../../types";
import { applyStartEndOffsets } from "../../utils/frontmatter/basics";
import { assignListToFrontmatter, parseCustomDoneProperty } from "../../utils/frontmatter/props";
import type { CalendarBundle } from "../calendar-bundle";
import type { EventFileRepository, FrontmatterSnapshot } from "../event-file-repository";

export class FrontmatterUpdateCommand implements Command {
	private snapshot: FrontmatterSnapshot | null = null;

	constructor(
		private repo: EventFileRepository,
		private filePath: string,
		private updater: (fm: Frontmatter) => void,
		private type: string
	) {}

	async execute(): Promise<void> {
		if (!this.snapshot) this.snapshot = await this.repo.snapshotByPath(this.filePath);
		await this.repo.updateFrontmatterByPath(this.filePath, this.updater);
	}

	async undo(): Promise<void> {
		if (!this.snapshot) return;
		await this.repo.restoreSnapshot(this.snapshot);
	}

	getType(): string {
		return this.type;
	}

	canUndo(): boolean {
		return this.snapshot !== null;
	}
}

export function markAsDone(bundle: CalendarBundle, filePath: string): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	const customProp = parseCustomDoneProperty(settings.customDoneProperty);
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			if (customProp) {
				fm[customProp.key] = customProp.value;
			} else {
				fm[settings.statusProperty] = settings.doneValue;
			}
		},
		"mark-as-done"
	);
}

export function markAsUndone(bundle: CalendarBundle, filePath: string): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	const doneProp = parseCustomDoneProperty(settings.customDoneProperty);
	const undoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			if (doneProp) {
				if (undoneProp) {
					fm[undoneProp.key] = undoneProp.value;
				} else {
					delete fm[doneProp.key];
				}
			} else {
				fm[settings.statusProperty] = settings.notDoneValue;
			}
		},
		"mark-as-undone"
	);
}

export function toggleSkip(bundle: CalendarBundle, filePath: string): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			if (fm[settings.skipProp] === true) {
				delete fm[settings.skipProp];
			} else {
				fm[settings.skipProp] = true;
			}
		},
		"toggle-skip"
	);
}

export function assignCategories(
	bundle: CalendarBundle,
	filePath: string,
	categories: string[]
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			assignListToFrontmatter(fm, settings.categoryProp, categories);
		},
		"assign-categories"
	);
}

export function assignPrerequisites(
	bundle: CalendarBundle,
	filePath: string,
	prerequisites: string[]
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			assignListToFrontmatter(fm, settings.prerequisiteProp, prerequisites);
		},
		"assign-prerequisites"
	);
}

export function addPrerequisite(
	bundle: CalendarBundle,
	targetFilePath: string,
	prerequisiteFilePath: string
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	const existing = bundle.fileRepository.getByPath(targetFilePath);
	const currentPrereqs = parseIntoList(existing?.[settings.prerequisiteProp], {
		splitCommas: false,
	});
	const wikiLink = toDisplayLink(prerequisiteFilePath);
	const updated = currentPrereqs.includes(wikiLink) ? currentPrereqs : [...currentPrereqs, wikiLink];
	return assignPrerequisites(bundle, targetFilePath, updated);
}

export function moveEvent(
	bundle: CalendarBundle,
	filePath: string,
	startOffset: DurationLike,
	endOffset: DurationLike
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			applyStartEndOffsets(fm, settings, startOffset, endOffset);
		},
		"move-event"
	);
}

export function fillTime(
	bundle: CalendarBundle,
	filePath: string,
	propertyName: string,
	newTimeValue: string
): FrontmatterUpdateCommand {
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			fm[propertyName] = ensureISOSuffix(newTimeValue);
		},
		"fill-time"
	);
}

export function updateFrontmatter(
	bundle: CalendarBundle,
	filePath: string,
	propertyUpdates: Map<string, string | null>
): FrontmatterUpdateCommand {
	return new FrontmatterUpdateCommand(
		bundle.fileRepository,
		filePath,
		(fm) => {
			for (const [key, value] of propertyUpdates.entries()) {
				if (value === null) {
					delete fm[key];
				} else {
					const parsed = parseFrontmatterRecord({ [key]: value });
					fm[key] = parsed[key];
				}
			}
		},
		"update-frontmatter"
	);
}
