import { getTFileOrThrow, withFrontmatter } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { Command } from "@real1ty-obsidian-plugins";
import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { assignListToFrontmatter, parseCustomDoneProperty } from "../../utils/event-frontmatter";
import type { CalendarBundle } from "../calendar-bundle";

abstract class SetStatusCommand implements Command {
	private captured = false;
	private originalStatusValue?: string;
	private originalCustomPropertyValue?: unknown;
	private customPropertyKey?: string;
	private usedCustomProperty = false;

	constructor(
		protected app: App,
		protected bundle: CalendarBundle,
		protected filePath: string
	) {}

	protected abstract getNewStatusValue(settings: SingleCalendarConfig): string;
	protected abstract getCustomPropertyChange(
		settings: SingleCalendarConfig
	): { key: string; value: unknown; action: "set" | "delete" } | null;
	abstract getType(): string;

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;
		const customChange = this.getCustomPropertyChange(settings);

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (!this.captured) {
				this.captured = true;
				this.originalStatusValue = fm[settings.statusProperty] as string | undefined;
				if (customChange) {
					this.originalCustomPropertyValue = fm[customChange.key];
				}
			}

			if (customChange) {
				// Custom property configured: use it instead of status property
				this.usedCustomProperty = true;
				this.customPropertyKey = customChange.key;
				if (customChange.action === "set") {
					fm[customChange.key] = customChange.value;
				} else {
					delete fm[customChange.key];
				}
			} else {
				// No custom property: fall back to status property
				fm[settings.statusProperty] = this.getNewStatusValue(settings);
			}
		});
	}

	async undo(): Promise<void> {
		if (!this.captured) return;

		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.usedCustomProperty && this.customPropertyKey) {
				if (this.originalCustomPropertyValue === undefined) {
					delete fm[this.customPropertyKey];
				} else {
					fm[this.customPropertyKey] = this.originalCustomPropertyValue;
				}
			} else {
				if (this.originalStatusValue === undefined) {
					delete fm[settings.statusProperty];
				} else {
					fm[settings.statusProperty] = this.originalStatusValue;
				}
			}
		});
	}

	canUndo(): boolean {
		return this.captured;
	}
}

export class MarkAsDoneCommand extends SetStatusCommand {
	protected getNewStatusValue(settings: SingleCalendarConfig): string {
		return settings.doneValue;
	}

	protected getCustomPropertyChange(settings: SingleCalendarConfig) {
		const prop = parseCustomDoneProperty(settings.customDoneProperty);
		if (!prop) return null;
		return { key: prop.key, value: prop.value, action: "set" as const };
	}

	getType(): string {
		return "mark-as-done";
	}
}

export class MarkAsUndoneCommand extends SetStatusCommand {
	protected getNewStatusValue(settings: SingleCalendarConfig): string {
		return settings.notDoneValue;
	}

	protected getCustomPropertyChange(settings: SingleCalendarConfig) {
		const doneProp = parseCustomDoneProperty(settings.customDoneProperty);
		if (!doneProp) return null;

		const undoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
		if (undoneProp) return { key: undoneProp.key, value: undoneProp.value, action: "set" as const };

		return { key: doneProp.key, value: undefined, action: "delete" as const };
	}

	getType(): string {
		return "mark-as-undone";
	}
}

export class ToggleSkipCommand implements Command {
	private originalSkipValue?: boolean;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			// Store original value on first execution
			if (this.originalSkipValue === undefined) {
				this.originalSkipValue = fm[settings.skipProp] === true;
			}

			// Toggle: if currently true or missing, set to true; if false, remove property
			const currentValue = fm[settings.skipProp] === true;
			if (currentValue) {
				delete fm[settings.skipProp];
			} else {
				fm[settings.skipProp] = true;
			}
		});
	}

	async undo(): Promise<void> {
		if (this.originalSkipValue === undefined) return;

		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalSkipValue) {
				fm[settings.skipProp] = true;
			} else {
				delete fm[settings.skipProp];
			}
		});
	}

	getType(): string {
		return "toggle-skip";
	}

	canUndo(): boolean {
		return this.originalSkipValue !== undefined;
	}
}

export class AssignCategoriesCommand implements Command {
	private originalCategoryValue?: string | string[] | undefined;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private categoriesToAdd: string[]
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalCategoryValue === undefined) {
				this.originalCategoryValue = fm[settings.categoryProp] as string | string[] | undefined;
			}

			assignListToFrontmatter(fm, settings.categoryProp, this.categoriesToAdd);
		});
	}

	async undo(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalCategoryValue === undefined) {
				delete fm[settings.categoryProp];
			} else {
				fm[settings.categoryProp] = this.originalCategoryValue;
			}
		});
	}

	canUndo(): boolean {
		return true;
	}

	getType(): string {
		return "assign-categories";
	}
}
