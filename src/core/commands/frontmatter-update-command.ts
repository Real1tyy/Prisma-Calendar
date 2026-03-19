import type { Command } from "@real1ty-obsidian-plugins";
import {
	backupFrontmatter,
	getTFileOrThrow,
	parseFrontmatterRecord,
	restoreFrontmatter,
	withFrontmatter,
} from "@real1ty-obsidian-plugins";
import type { DurationLike } from "luxon";
import type { App } from "obsidian";

import type { Frontmatter } from "../../types";
import { applyStartEndOffsets, assignListToFrontmatter, parseCustomDoneProperty } from "../../utils/event-frontmatter";
import type { CalendarBundle } from "../calendar-bundle";

export class FrontmatterUpdateCommand implements Command {
	private originalFrontmatter?: Frontmatter;

	constructor(
		private app: App,
		private filePath: string,
		private updater: (fm: Frontmatter) => void,
		private type: string
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);
		await withFrontmatter(this.app, file, this.updater);
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;
		const file = getTFileOrThrow(this.app, this.filePath);
		await restoreFrontmatter(this.app, file, this.originalFrontmatter);
	}

	getType(): string {
		return this.type;
	}

	canUndo(): boolean {
		return this.originalFrontmatter !== undefined;
	}
}

export function markAsDone(app: App, bundle: CalendarBundle, filePath: string): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	const customProp = parseCustomDoneProperty(settings.customDoneProperty);
	return new FrontmatterUpdateCommand(
		app,
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

export function markAsUndone(app: App, bundle: CalendarBundle, filePath: string): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	const doneProp = parseCustomDoneProperty(settings.customDoneProperty);
	const undoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
	return new FrontmatterUpdateCommand(
		app,
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

export function toggleSkip(app: App, bundle: CalendarBundle, filePath: string): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		app,
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
	app: App,
	bundle: CalendarBundle,
	filePath: string,
	categories: string[]
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		app,
		filePath,
		(fm) => {
			assignListToFrontmatter(fm, settings.categoryProp, categories);
		},
		"assign-categories"
	);
}

export function assignPrerequisites(
	app: App,
	bundle: CalendarBundle,
	filePath: string,
	prerequisites: string[]
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		app,
		filePath,
		(fm) => {
			assignListToFrontmatter(fm, settings.prerequisiteProp, prerequisites);
		},
		"assign-prerequisites"
	);
}

export function moveEvent(
	app: App,
	bundle: CalendarBundle,
	filePath: string,
	startOffset: DurationLike,
	endOffset: DurationLike
): FrontmatterUpdateCommand {
	const settings = bundle.settingsStore.currentSettings;
	return new FrontmatterUpdateCommand(
		app,
		filePath,
		(fm) => {
			applyStartEndOffsets(fm, settings, startOffset, endOffset);
		},
		"move-event"
	);
}

export function fillTime(
	app: App,
	filePath: string,
	propertyName: string,
	newTimeValue: string
): FrontmatterUpdateCommand {
	return new FrontmatterUpdateCommand(
		app,
		filePath,
		(fm) => {
			fm[propertyName] = newTimeValue;
		},
		"fill-time"
	);
}

export function updateFrontmatter(
	app: App,
	filePath: string,
	propertyUpdates: Map<string, string | null>
): FrontmatterUpdateCommand {
	return new FrontmatterUpdateCommand(
		app,
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
