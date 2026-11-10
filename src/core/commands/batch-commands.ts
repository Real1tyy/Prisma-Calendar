import { batchCommand, MacroCommand } from "@real1ty/obsidian-plugins";
import type { DurationLike } from "luxon";
import type { App } from "obsidian";

import type { IntegrationDeletionTombstone } from "../../types/integrations";
import type { CalendarBundle } from "../calendar-bundle";
import type { FrontmatterSnapshot } from "../event-file-repository";
import { getIntegrationDeletionTombstone } from "../integrations/deleted-event-tombstones";
import { deleteCategoryCommand, renameCategoryCommand } from "./category-commands";
import {
	assignCategories,
	markAsDone,
	markAsUndone,
	moveEvent,
	toggleSkip,
	updateFrontmatter,
} from "./frontmatter-update-command";
import { CloneEventCommand, DeleteEventCommand } from "./lifecycle-commands";
import { ConvertToRealCommand, ConvertToVirtualCommand } from "./virtual-event-commands";

class IntegrationBatchDeleteCommand extends MacroCommand {
	private snapshots: FrontmatterSnapshot[] | null = null;
	private readonly restored: IntegrationDeletionTombstone[];

	constructor(
		private readonly bundle: CalendarBundle,
		private readonly paths: string[]
	) {
		const restored: IntegrationDeletionTombstone[] = [];
		super(
			paths.map(
				(path) =>
					new DeleteEventCommand(bundle.fileRepository, path, {
						onDelete: async () => {},
						onUndo: (snapshot) => {
							const identity = getIntegrationDeletionTombstone(snapshot.data, bundle.settingsStore.currentSettings);
							if (identity) restored.push(identity);
							return Promise.resolve();
						},
					})
			)
		);
		this.restored = restored;
	}

	override async execute(): Promise<void> {
		await this.executeBatch(() => super.execute());
	}
	override async executeWithProgress(progress: (completed: number, total: number) => void): Promise<void> {
		await this.executeBatch(() => super.executeWithProgress(progress));
	}
	override async undo(): Promise<void> {
		await this.restoreBatch(() => super.undo());
	}
	override async undoWithProgress(progress: (completed: number, total: number) => void): Promise<void> {
		await this.restoreBatch(() => super.undoWithProgress(progress));
	}

	private async executeBatch(execute: () => Promise<void>): Promise<void> {
		this.snapshots ??= await Promise.all(this.paths.map((path) => this.bundle.fileRepository.snapshotByPath(path)));
		const identities = this.snapshots.flatMap((snapshot) => {
			const identity = getIntegrationDeletionTombstone(snapshot.data, this.bundle.settingsStore.currentSettings);
			return identity ? [identity] : [];
		});
		await this.persist(identities, true);
		await this.restoreBatch(execute);
	}

	private async restoreBatch(operation: () => Promise<void>): Promise<void> {
		this.restored.length = 0;
		try {
			await operation();
		} finally {
			await this.persist(this.restored, false);
		}
	}

	private async persist(identities: readonly IntegrationDeletionTombstone[], deleted: boolean): Promise<void> {
		if (identities.length === 0) return;
		const data = this.bundle.prismaDataFile;
		await data.setDeleted(identities, deleted, () =>
			this.bundle.fileRepository.assertWritable("batch deletion history")
		);
	}
}

export function createBatchDelete(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return new IntegrationBatchDeleteCommand(bundle, filePaths);
}

export function createBatchDuplicate(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => new CloneEventCommand(app, bundle, fp));
}

export function createBatchMove(bundle: CalendarBundle, filePaths: string[], weeks: number): MacroCommand {
	const d: DurationLike = { weeks };
	return batchCommand(filePaths, (fp) => moveEvent(bundle, fp, d, d));
}

export function createBatchClone(app: App, bundle: CalendarBundle, filePaths: string[], weeks: number): MacroCommand {
	const d: DurationLike = { weeks };
	return batchCommand(filePaths, (fp) => new CloneEventCommand(app, bundle, fp, d, d));
}

export function createBatchSkip(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => toggleSkip(bundle, fp));
}

export function createBatchMoveBy(bundle: CalendarBundle, filePaths: string[], offset: DurationLike): MacroCommand {
	return batchCommand(filePaths, (fp) => moveEvent(bundle, fp, offset, offset));
}

export function createBatchMarkAsDone(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => markAsDone(bundle, fp));
}

export function createBatchMarkAsNotDone(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => markAsUndone(bundle, fp));
}

export function createBatchAssignCategories(
	bundle: CalendarBundle,
	filePaths: string[],
	categories: string[]
): MacroCommand {
	return batchCommand(filePaths, (fp) => assignCategories(bundle, fp, categories));
}

export function createBatchUpdateFrontmatter(
	bundle: CalendarBundle,
	filePaths: string[],
	propertyUpdates: Map<string, string | null>
): MacroCommand {
	return batchCommand(filePaths, (fp) => updateFrontmatter(bundle, fp, propertyUpdates));
}

export function createBatchMakeVirtual(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => new ConvertToVirtualCommand(app, bundle, fp));
}

export function createBatchMakeReal(app: App, bundle: CalendarBundle, virtualEventIds: string[]): MacroCommand {
	return batchCommand(virtualEventIds, (id) => new ConvertToRealCommand(app, bundle, id));
}

export function createBatchRenameCategory(
	bundle: CalendarBundle,
	filePaths: string[],
	oldName: string,
	newName: string
): MacroCommand {
	const categoryProp = bundle.settingsStore.currentSettings.categoryProp;
	return batchCommand(filePaths, (fp) =>
		renameCategoryCommand(bundle.fileRepository, fp, oldName, newName, categoryProp)
	);
}

export function createBatchDeleteCategory(
	bundle: CalendarBundle,
	filePaths: string[],
	categoryName: string
): MacroCommand {
	const categoryProp = bundle.settingsStore.currentSettings.categoryProp;
	return batchCommand(filePaths, (fp) => deleteCategoryCommand(bundle.fileRepository, fp, categoryName, categoryProp));
}
