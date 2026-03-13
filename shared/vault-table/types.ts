import type { App, TFile } from "obsidian";

import type { FrontmatterDiff } from "../file/frontmatter-diff";
import type { SerializableSchema } from "./create-mapped-schema";

export type InvalidStrategy = "skip" | "correct" | "delete";

export interface VaultTableConfig<TData, TSchema extends SerializableSchema<TData> = SerializableSchema<TData>> {
	app: App;
	directory: string;
	schema: TSchema;
	invalidStrategy?: InvalidStrategy;
	skipFolderNotes?: boolean;
	debounceMs?: number;
}

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

export type VaultTableEvent<TData> =
	| { type: "row-created"; id: string; filePath: string; row: VaultRow<TData> }
	| {
			type: "row-updated";
			id: string;
			filePath: string;
			oldRow: VaultRow<TData>;
			newRow: VaultRow<TData>;
			diff: FrontmatterDiff;
	  }
	| { type: "row-deleted"; id: string; filePath: string; oldRow: VaultRow<TData> };
