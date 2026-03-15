import type { App, TFile } from "obsidian";

import type { CommandManager } from "../commands/command-manager";
import type { FrontmatterDiff } from "../file/frontmatter-diff";
import type { SerializableSchema } from "./create-mapped-schema";

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
}

interface FileVaultTableDef<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
> extends VaultTableDefBase<TData, TSchema> {
	nodeType?: "files";
	children?: never;
}

interface FolderNoteVaultTableDef<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	TChildren extends VaultTableDefMap = {},
> extends VaultTableDefBase<TData, TSchema> {
	nodeType: "folderNotes";
	children?: TChildren;
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
};

export interface VaultRow<TData> {
	id: string;
	file: TFile;
	filePath: string;
	data: TData;
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
