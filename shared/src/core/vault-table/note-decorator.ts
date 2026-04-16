import type { Plugin, TFile } from "obsidian";
import { MarkdownView } from "obsidian";

import { extractFileName, getFolderPath, isFolderNote } from "../file/file";
import type { SerializableSchema } from "./create-mapped-schema";
import type { VaultTableDefMap } from "./types";
import type { VaultTable, VaultTableRow } from "./vault-table";

export type NoteDecoratorRender<TData, TChildren extends VaultTableDefMap> = (
	container: HTMLElement,
	row: VaultTableRow<TData, TChildren>
) => void | Promise<void>;

export class NoteDecorator<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	TChildren extends VaultTableDefMap = Record<string, never>,
> {
	private activeContainer: HTMLElement | null = null;
	private generation = 0;

	constructor(
		private plugin: Plugin,
		private table: VaultTable<TData, TSchema, TChildren>,
		private render: NoteDecoratorRender<TData, TChildren>
	) {
		plugin.registerEvent(
			plugin.app.workspace.on("file-open", (file) => {
				void this.onFileOpen(file);
			})
		);
	}

	private async onFileOpen(file: TFile | null): Promise<void> {
		const currentGen = ++this.generation;
		this.cleanup();

		if (!file || !file.path.startsWith(this.table.directory + "/")) return;

		if (isFolderNote(file.path) && getFolderPath(file.path) === this.table.directory) return;

		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const fileName = extractFileName(file.path);

		await this.table.waitUntilReady();
		if (currentGen !== this.generation) return;

		if (!this.table.get(fileName)) return;

		const hydrated = await this.table.getHydrated(fileName);
		if (!hydrated || currentGen !== this.generation) return;

		const container = createDiv({ cls: "vault-table-note-decorator" });
		view.contentEl.prepend(container);
		this.activeContainer = container;

		await this.render(container, hydrated);
	}

	private cleanup(): void {
		this.activeContainer?.remove();
		this.activeContainer = null;
	}
}
