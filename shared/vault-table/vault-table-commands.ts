import type { Command } from "../commands/command";
import type { InsertVaultRow, VaultRow } from "./types";

export interface VaultTableOps<TData> {
	create(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>>;
	update(key: string, data: Partial<TData>): Promise<VaultRow<TData>>;
	/** Replaces the entire data object without merging — supports property deletion */
	replace(key: string, data: TData): Promise<VaultRow<TData>>;
	updateContent(key: string, content: string): Promise<VaultRow<TData>>;
	delete(key: string): Promise<void>;
	get(key: string): VaultRow<TData> | undefined;
	has(key: string): boolean;
	readFileContent(key: string): Promise<string>;
	restoreFile(filePath: string, rawContent: string, data: TData, bodyContent: string): Promise<void>;
}

export interface CommandWithResult<T> extends Command {
	getResult(): T;
}

// ─── Shared snapshot + undo logic ────────────────────────────

interface FileSnapshot<TData> {
	filePath: string;
	rawContent: string;
	data: TData;
	bodyContent: string;
}

/**
 * Base for commands that snapshot a row before mutating it.
 * Subclasses provide the mutation via doExecute() and the command type via getType().
 * Undo restores the file from the snapshot — identical across all mutation commands.
 */
abstract class SnapshotCommand<TData> implements Command {
	protected snapshot: FileSnapshot<TData> | null = null;

	constructor(
		protected readonly key: string,
		protected readonly ops: VaultTableOps<TData>
	) {}

	async execute(): Promise<void> {
		const existing = this.ops.get(this.key);
		if (existing) {
			this.snapshot = {
				filePath: existing.filePath,
				rawContent: await this.ops.readFileContent(this.key),
				data: { ...existing.data },
				bodyContent: existing.content,
			};
		}
		await this.doExecute();
	}

	async undo(): Promise<void> {
		if (this.snapshot) {
			await this.ops.restoreFile(
				this.snapshot.filePath,
				this.snapshot.rawContent,
				this.snapshot.data,
				this.snapshot.bodyContent
			);
		}
	}

	canUndo(): boolean {
		return this.snapshot !== null;
	}

	protected abstract doExecute(): Promise<void>;
	abstract getType(): string;
}

/** Snapshot command that produces a result row (for update/replace/updateContent) */
abstract class SnapshotRowCommand<TData> extends SnapshotCommand<TData> implements CommandWithResult<VaultRow<TData>> {
	protected result: VaultRow<TData> | null = null;

	getResult(): VaultRow<TData> {
		if (!this.result) throw new Error(`${this.getType()}: not executed yet`);
		return this.result;
	}
}

// ─── Concrete Commands ───────────────────────────────────────

export class CreateRowCommand<TData> implements CommandWithResult<VaultRow<TData>> {
	private createdRow: VaultRow<TData> | null = null;

	constructor(
		private readonly insert: InsertVaultRow<TData>,
		private readonly ops: VaultTableOps<TData>
	) {}

	async execute(): Promise<void> {
		this.createdRow = await this.ops.create(this.insert);
	}

	async undo(): Promise<void> {
		if (this.createdRow) {
			await this.ops.delete(this.createdRow.id);
			this.createdRow = null;
		}
	}

	getType(): string {
		return "vault-table:create";
	}

	canUndo(): boolean {
		return this.createdRow !== null && this.ops.has(this.createdRow.id);
	}

	getResult(): VaultRow<TData> {
		if (!this.createdRow) throw new Error("CreateRowCommand: not executed yet");
		return this.createdRow;
	}
}

export class UpdateRowCommand<TData> extends SnapshotRowCommand<TData> {
	constructor(
		key: string,
		private readonly newData: Partial<TData>,
		ops: VaultTableOps<TData>
	) {
		super(key, ops);
	}

	protected async doExecute(): Promise<void> {
		this.result = await this.ops.update(this.key, this.newData);
	}

	getType(): string {
		return "vault-table:update";
	}
}

export class ReplaceRowCommand<TData> extends SnapshotRowCommand<TData> {
	constructor(
		key: string,
		private readonly newData: TData,
		ops: VaultTableOps<TData>
	) {
		super(key, ops);
	}

	protected async doExecute(): Promise<void> {
		this.result = await this.ops.replace(this.key, this.newData);
	}

	getType(): string {
		return "vault-table:replace";
	}
}

export class UpdateContentRowCommand<TData> extends SnapshotRowCommand<TData> {
	constructor(
		key: string,
		private readonly newContent: string,
		ops: VaultTableOps<TData>
	) {
		super(key, ops);
	}

	protected async doExecute(): Promise<void> {
		this.result = await this.ops.updateContent(this.key, this.newContent);
	}

	getType(): string {
		return "vault-table:update-content";
	}
}

export class DeleteRowCommand<TData> extends SnapshotCommand<TData> {
	constructor(key: string, ops: VaultTableOps<TData>) {
		super(key, ops);
	}

	protected async doExecute(): Promise<void> {
		await this.ops.delete(this.key);
	}

	getType(): string {
		return "vault-table:delete";
	}

	override canUndo(): boolean {
		return this.snapshot !== null && !this.ops.has(this.key);
	}
}
