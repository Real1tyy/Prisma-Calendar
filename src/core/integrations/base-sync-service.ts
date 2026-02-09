import { sanitizeForFilename } from "@real1ty-obsidian-plugins";
import { type App, Notice, normalizePath, TFile } from "obsidian";
import type { Subscription } from "rxjs";
import type { Frontmatter } from "../../types";
import { extractZettelId, removeZettelId } from "../../utils/calendar-events";
import type { CalendarBundle } from "../calendar-bundle";
import type { SettingsStore } from "../settings-store";
import { buildFrontmatterFromImportedEvent, createEventNoteFromImportedEvent, type ImportedEvent } from "./ics-import";

export async function yieldToMainThread(): Promise<void> {
	if ("scheduler" in window && window.scheduler) {
		const scheduler = window.scheduler as { yield?: () => Promise<void> };
		if (scheduler.yield) {
			await scheduler.yield();
			return;
		}
	}
	await new Promise((resolve) => window.setTimeout(resolve, 0));
}

export interface BaseSyncResult {
	success: boolean;
	created: number;
	updated: number;
	deleted: number;
	errors: string[];
}

export interface BaseSyncServiceOptions {
	app: App;
	bundle: CalendarBundle;
	mainSettingsStore: SettingsStore;
}

export abstract class BaseSyncService<TResult extends BaseSyncResult> {
	protected app: App;
	protected bundle: CalendarBundle;
	protected mainSettingsStore: SettingsStore;
	protected settingsSubscription: Subscription | null = null;

	constructor(options: BaseSyncServiceOptions) {
		this.app = options.app;
		this.bundle = options.bundle;
		this.mainSettingsStore = options.mainSettingsStore;
	}

	abstract sync(): Promise<TResult>;

	protected abstract getSyncName(): string;
	protected abstract shouldNotifyOnSync(): boolean;

	protected async createNoteFromImportedEvent(
		event: ImportedEvent,
		timezone: string,
		additionalFrontmatter: Record<string, unknown>
	): Promise<void> {
		const folderPath = this.getSyncFolderPath();

		await createEventNoteFromImportedEvent(this.app, this.bundle, event, {
			targetDirectory: folderPath,
			timezone,
			additionalFrontmatter,
		});
	}

	protected async updateNoteFromImportedEvent(
		filePath: string,
		event: ImportedEvent,
		timezone: string,
		additionalFrontmatter: Record<string, unknown>
	): Promise<void> {
		let file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const settings = this.bundle.settingsStore.currentSettings;

		const currentBasenameWithoutZettel = removeZettelId(file.basename);
		const newTitle = sanitizeForFilename(event.title, {
			style: "preserve",
		});

		const titleChanged = currentBasenameWithoutZettel !== newTitle;

		if (titleChanged) {
			const existingZettelId = extractZettelId(file.basename);
			if (existingZettelId) {
				const directory = file.parent?.path || "";
				const newFilename = `${newTitle} - ${existingZettelId}`;
				const newPath = directory ? `${directory}/${newFilename}.md` : `${newFilename}.md`;

				await this.app.fileManager.renameFile(file, newPath);

				file = this.app.vault.getAbstractFileByPath(newPath);
				if (!(file instanceof TFile)) {
					throw new Error(`File not found after rename: ${newPath}`);
				}
			}
		}

		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			const eventFm = buildFrontmatterFromImportedEvent(event, settings, timezone);
			Object.assign(fm, eventFm);
			Object.assign(fm, additionalFrontmatter);
		});
	}

	protected getSyncFolderPath(): string {
		return normalizePath(this.bundle.settingsStore.currentSettings.directory);
	}

	protected showSyncNotification(result: TResult): void {
		if (!this.shouldNotifyOnSync()) {
			return;
		}

		if (result.created === 0 && result.updated === 0 && result.deleted === 0 && result.errors.length === 0) {
			return;
		}

		const parts: string[] = [];
		if (result.created > 0) parts.push(`${result.created} created`);
		if (result.updated > 0) parts.push(`${result.updated} updated`);
		if (result.deleted > 0) parts.push(`${result.deleted} deleted`);
		if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);

		new Notice(`${this.getSyncName()}: ${parts.join(", ")}`);
	}

	protected showSyncErrorNotification(errorMsg: string): void {
		if (!this.shouldNotifyOnSync()) {
			return;
		}

		new Notice(`${this.getSyncName()} sync failed: ${errorMsg}`);
	}

	destroy(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
	}
}
