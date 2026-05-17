import type { Command } from "./command";

/**
 * Minimal interface a per-file frontmatter store must satisfy to plug into
 * {@link FrontmatterUpdateCommand}. The snapshot type is opaque to the command
 * — the repo decides what it needs to capture for {@link restoreSnapshot} to
 * undo a mutation.
 *
 * Plugins typically already have an `updateFrontmatterByPath` / `snapshotByPath`
 * / `restoreSnapshot` triple on their file repository; declaring `implements
 * FrontmatterRepo<TData, TSnapshot>` makes the contract explicit and unlocks
 * undoable frontmatter mutations via {@link FrontmatterUpdateCommand}.
 */
export interface FrontmatterRepo<TData = unknown, TSnapshot = unknown> {
	updateFrontmatterByPath(filePath: string, updater: (fm: TData) => void): Promise<TData>;
	snapshotByPath(filePath: string): Promise<TSnapshot>;
	restoreSnapshot(snapshot: TSnapshot): Promise<void>;
}

/**
 * Snapshot-based, undoable per-file frontmatter mutation.
 *
 * Captures a full snapshot on first {@link execute}, then replays the
 * caller-supplied `updater`. {@link undo} restores from the captured snapshot
 * via the repo. Subsequent {@link execute} calls (redo) reuse the original
 * snapshot.
 *
 * The command is intentionally generic over `TData` (the frontmatter shape)
 * and `TSnapshot` (the repo's snapshot representation). For Prisma-Calendar
 * that's `Frontmatter` and `FrontmatterSnapshot`; other plugins can pick their
 * own.
 */
export class FrontmatterUpdateCommand<TData = unknown, TSnapshot = unknown> implements Command {
	private snapshot: TSnapshot | null = null;

	constructor(
		private repo: FrontmatterRepo<TData, TSnapshot>,
		private filePath: string,
		private updater: (fm: TData) => void,
		private type: string
	) {}

	async execute(): Promise<void> {
		if (this.snapshot === null) this.snapshot = await this.repo.snapshotByPath(this.filePath);
		await this.repo.updateFrontmatterByPath(this.filePath, this.updater);
	}

	async undo(): Promise<void> {
		if (this.snapshot === null) return;
		await this.repo.restoreSnapshot(this.snapshot);
	}

	getType(): string {
		return this.type;
	}

	canUndo(): boolean {
		return this.snapshot !== null;
	}
}
