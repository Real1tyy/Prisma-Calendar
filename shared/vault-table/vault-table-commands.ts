import type { Command } from "../commands/command";
import type { InsertVaultRow, VaultRow } from "./types";

export interface VaultTableOps<TData> {
	create(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>>;
	update(key: string, data: Partial<TData>): Promise<VaultRow<TData>>;
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

interface FileSnapshot<TData> {
	filePath: string;
	rawContent: string;
	data: TData;
	bodyContent: string;
}

export class UpdateRowCommand<TData> implements CommandWithResult<VaultRow<TData>> {
	private snapshot: FileSnapshot<TData> | null = null;
	private result: VaultRow<TData> | null = null;

	constructor(
		private readonly key: string,
		private readonly newData: Partial<TData>,
		private readonly ops: VaultTableOps<TData>
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
		this.result = await this.ops.update(this.key, this.newData);
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

	getType(): string {
		return "vault-table:update";
	}

	canUndo(): boolean {
		return this.snapshot !== null && this.ops.has(this.key);
	}

	getResult(): VaultRow<TData> {
		if (!this.result) throw new Error("UpdateRowCommand: not executed yet");
		return this.result;
	}
}

export class UpdateContentRowCommand<TData> implements CommandWithResult<VaultRow<TData>> {
	private snapshot: FileSnapshot<TData> | null = null;
	private result: VaultRow<TData> | null = null;

	constructor(
		private readonly key: string,
		private readonly newContent: string,
		private readonly ops: VaultTableOps<TData>
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
		this.result = await this.ops.updateContent(this.key, this.newContent);
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

	getType(): string {
		return "vault-table:update-content";
	}

	canUndo(): boolean {
		return this.snapshot !== null && this.ops.has(this.key);
	}

	getResult(): VaultRow<TData> {
		if (!this.result) throw new Error("UpdateContentRowCommand: not executed yet");
		return this.result;
	}
}

export class DeleteRowCommand<TData> implements Command {
	private snapshot: FileSnapshot<TData> | null = null;

	constructor(
		private readonly key: string,
		private readonly ops: VaultTableOps<TData>
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
		await this.ops.delete(this.key);
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

	getType(): string {
		return "vault-table:delete";
	}

	canUndo(): boolean {
		return this.snapshot !== null && !this.ops.has(this.key);
	}
}
