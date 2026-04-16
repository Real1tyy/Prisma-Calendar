import type { Plugin, TFile } from "obsidian";
import { MarkdownView } from "obsidian";

import { getFolderPath, isFolderNote } from "../file/file";
import type { SerializableSchema } from "./create-mapped-schema";
import type { VaultTableDefMap } from "./types";
import type { VaultTable } from "./vault-table";

export type TableViewRender<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	TChildren extends VaultTableDefMap = Record<string, never>,
> = (container: HTMLElement, table: VaultTable<TData, TSchema, TChildren>) => void | Promise<void>;

export class TableView<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	TChildren extends VaultTableDefMap = Record<string, never>,
> {
	private activeContainer: HTMLElement | null = null;

	constructor(
		private plugin: Plugin,
		private table: VaultTable<TData, TSchema, TChildren>,
		private render: TableViewRender<TData, TSchema, TChildren>
	) {
		plugin.registerEvent(
			plugin.app.workspace.on("file-open", (file) => {
				void this.onFileOpen(file);
			})
		);
	}

	private async onFileOpen(file: TFile | null): Promise<void> {
		this.cleanup();

		if (!file) return;
		if (!isFolderNote(file.path) || getFolderPath(file.path) !== this.table.directory) return;

		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		await this.table.waitUntilReady();

		const container = createDiv({ cls: "vault-table-view" });
		view.contentEl.prepend(container);
		this.activeContainer = container;

		await this.render(container, this.table);
	}

	private cleanup(): void {
		this.activeContainer?.remove();
		this.activeContainer = null;
	}
}
