import type { App, TFile } from "obsidian";

import type { CommandManager } from "../commands/command-manager";
import type { FrontmatterDiff } from "../frontmatter/frontmatter-diff";
import type { SerializableSchema } from "./create-mapped-schema";
import type { IdbFactory, PersistenceConfig } from "./persistence";

export type InvalidStrategy = "skip" | "correct" | "delete";

export type NodeType = "files" | "folderNotes";

interface VaultTableDefBase<TData, TSchema extends SerializableSchema<TData> = SerializableSchema<TData>> {
	schema: TSchema;
	fileNameFilter?: (fileName: string) => boolean;
	invalidStrategy?: InvalidStrategy;
	debounceMs?: number;
	filePathResolver?: (directory: string, fileName: string) => string;
	history?: VaultTableHistoryConfig;
	templatePath?: string;
	preloadedFiles?: TFile[];
	parentProperty?: string;
}

interface FileVaultTableDef<TData, TSchema extends SerializableSchema<TData> = SerializableSchema<TData>>
	extends VaultTableDefBase<TData, TSchema> {
	nodeType?: "files";
	children?: never;
	/**
	 * When true, all markdown files anywhere under the directory tree are indexed
	 * at any depth, not just direct children. Defaults to false (direct children only).
	 * Only available in "files" mode — incompatible with "folderNotes" because
	 * recursive scanning would overlap with per-folder-note child tables.
	 */
	recursive?: boolean;
}

interface FolderNoteVaultTableDef<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	TChildren extends VaultTableDefMap = {},
> extends VaultTableDefBase<TData, TSchema> {
	nodeType: "folderNotes";
	children?: TChildren;
	recursive?: never;
}

export type VaultTableDef<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	TChildren extends VaultTableDefMap = {},
> = FileVaultTableDef<TData, TSchema> | FolderNoteVaultTableDef<TData, TSchema, TChildren>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyVaultTableDef = VaultTableDef<any, any, any>;

export type VaultTableDefMap = Record<string, AnyVaultTableDef>;

export function defineChildren<T extends VaultTableDefMap>(defs: T): T {
	return defs;
}

export const HISTORY_MAX_SIZE = 50;
export const HISTORY_SHOW_NOTICES = false;

export interface VaultTableHistoryConfig {
	maxSize?: number;
	showNotices?: boolean;
	commandManager?: CommandManager;
}

export type VaultTableConfig<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	TChildren extends VaultTableDefMap = {},
> = VaultTableDef<TData, TSchema, TChildren> & {
	app: App;
	directory: string;
	/**
	 * When true, CRUD methods (create/update/delete) emit events$ immediately
	 * instead of relying on the indexer to detect the change on disk.
	 * By default, VaultTable suppresses events for self-initiated writes
	 * (mtime dedup) so only external file changes produce events.
	 * Enable this when consumers subscribe to events$ for reactivity.
	 */
	emitCrudEvents?: boolean;
	/**
	 * When provided, the table hydrates parsed rows from IndexedDB on start
	 * and writes them through on every indexer event. On cold start the Zod
	 * parse is skipped for files whose mtime matches the cached entry.
	 * One IDB database per `namespace`, isolated across plugins.
	 */
	persistence?: PersistenceConfig;
	/**
	 * Test-only IDB factory override. Leave unset in production — it defaults
	 * to the browser's `indexedDB`.
	 */
	persistenceIdbFactory?: IdbFactory;
};

/**
 * Minimal row interface — only requires an ID and typed data.
 * Used by the reactive primitives (ReadableTable, views, group-by, live queries)
 * so they work with both VaultTable (file-backed) and CodeBlockRepository (JSON-backed).
 */
export interface DataRow<TData> {
	id: string;
	data: TData;
}

export interface VaultRow<TData> extends DataRow<TData> {
	file: TFile;
	filePath: string;
	content: string;
	mtime: number;
}

export interface InsertVaultRow<TData> {
	fileName: string;
	data: TData;
	content?: string;
}

export type VaultTableEvent<TData, TRow = VaultRow<TData>> =
	| { type: "row-created"; id: string; filePath: string; row: TRow }
	| {
			type: "row-updated";
			id: string;
			filePath: string;
			oldRow: TRow;
			newRow: TRow;
			diff?: FrontmatterDiff;
			contentChanged: boolean;
	  }
	| { type: "row-deleted"; id: string; filePath: string; oldRow: TRow };
