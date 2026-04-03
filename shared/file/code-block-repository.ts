import { type App, MarkdownView, type TFile, TFolder, type Vault } from "obsidian";
import type { z } from "zod";

import type { Repository } from "../repository";
import { isFolderNote } from "./file";
import { ensureDirectory } from "./file-utils";

export interface CodeBlockBinding {
	unsubscribe: () => void;
}

export interface CodeBlockBindOptions {
	onChange?: () => void;
	/** When true, creates the directory and file with an empty code block if missing. */
	createIfMissing?: boolean;
}

export interface CodeBlockRepositoryConfig<T> {
	codeFence: string;
	itemSchema: z.ZodType<T>;
	idField?: keyof T & string;
	sort?: (a: T, b: T) => number;
}

export class CodeBlockRepository<T> implements Repository<T> {
	private readonly codeFence: string;
	private readonly itemSchema: z.ZodType<T>;
	private readonly idField: (keyof T & string) | null;
	private readonly sortComparator: ((a: T, b: T) => number) | null;

	private itemMap = new Map<string, T>();
	private sortedItems: T[] = [];
	private boundFile: { app: App; file: TFile } | null = null;
	// Incremented before our own writes, decremented in the vault listener to skip self-triggered reloads.
	private pendingSelfWrites = 0;

	constructor(config: CodeBlockRepositoryConfig<T>) {
		this.codeFence = config.codeFence;
		this.itemSchema = config.itemSchema;
		this.idField = config.idField ?? null;
		this.sortComparator = config.sort ?? null;
	}

	// --- CRUD API (requires idField + sort) ---

	async load(app: App, file: TFile): Promise<void> {
		this.boundFile = { app, file };
		const items = await this.read(app.vault, file);
		this.populateIndex(items);
	}

	loadFromRaw(raw: string, app: App, file: TFile): void {
		this.boundFile = { app, file };
		const items = this.parse(raw);
		this.populateIndex(items);
	}

	/**
	 * Binds the repository to a file path. Loads from the file if it exists.
	 * When `createIfMissing` is true, creates the directory and file with an
	 * empty code block before loading. Registers a vault modify listener to
	 * reload on external changes.
	 */
	async bind(app: App, filePath: string, options?: CodeBlockBindOptions): Promise<CodeBlockBinding> {
		const { onChange, createIfMissing = false } = options ?? {};

		let file = this.resolveFile(app, filePath);

		if (!file && createIfMissing) {
			file = await this.createBackingFile(app, filePath);
		}

		if (file) {
			await this.load(app, file);
			onChange?.();
		}

		const vaultRef = app.vault.on("modify", (modified) => {
			if (modified.path !== filePath) return;
			if (this.pendingSelfWrites > 0) {
				this.pendingSelfWrites--;
				return;
			}
			const current = this.resolveFile(app, filePath);
			if (current) {
				void this.load(app, current).then(() => onChange?.());
			}
		});

		return {
			unsubscribe: () => {
				app.vault.offref(vaultRef);
			},
		};
	}

	/**
	 * Rebinds the repository to a new file path. Unsubscribes the old binding,
	 * clears the index, and creates a new binding.
	 */
	async rebind(
		oldBinding: CodeBlockBinding,
		app: App,
		filePath: string,
		options?: CodeBlockBindOptions
	): Promise<CodeBlockBinding> {
		oldBinding.unsubscribe();
		this.itemMap.clear();
		this.sortedItems = [];
		this.boundFile = null;
		return this.bind(app, filePath, options);
	}

	private resolveFile(app: App, filePath: string): TFile | null {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file || file instanceof TFolder) return null;
		return file as TFile;
	}

	private async createBackingFile(app: App, filePath: string): Promise<TFile> {
		const lastSlash = filePath.lastIndexOf("/");
		if (lastSlash > 0) {
			await ensureDirectory(app, filePath.substring(0, lastSlash));
		}
		const content = `\`\`\`${this.codeFence}\n[]\n\`\`\`\n`;
		return (await app.vault.create(filePath, content)) as TFile;
	}

	getAll(): T[] {
		return [...this.sortedItems];
	}

	get(id: string): T | undefined {
		return this.itemMap.get(id);
	}

	has(id: string): boolean {
		return this.itemMap.has(id);
	}

	async create(item: T): Promise<T> {
		const key = this.extractId(item);
		if (this.itemMap.has(key)) {
			throw new Error(`Item with ID "${key}" already exists`);
		}
		this.itemMap.set(key, item);
		this.rebuildSorted();
		await this.persist();
		return item;
	}

	async update(id: string, partial: Partial<T>): Promise<T> {
		const existing = this.itemMap.get(id);
		if (!existing) {
			throw new Error(`Item with ID "${id}" not found`);
		}
		const updated = { ...existing, ...partial };
		const newKey = this.extractId(updated);

		if (newKey !== id) {
			this.itemMap.delete(id);
		}
		this.itemMap.set(newKey, updated);
		this.rebuildSorted();
		await this.persist();
		return updated;
	}

	async delete(id: string): Promise<void> {
		if (!this.itemMap.has(id)) return;
		this.itemMap.delete(id);
		this.rebuildSorted();
		await this.persist();
	}

	// --- Index helpers ---

	private populateIndex(items: T[]): void {
		this.itemMap.clear();
		for (const item of items) {
			const key = this.extractId(item);
			this.itemMap.set(key, item);
		}
		this.rebuildSorted();
	}

	private rebuildSorted(): void {
		this.sortedItems = [...this.itemMap.values()];
		if (this.sortComparator) {
			this.sortedItems.sort(this.sortComparator);
		}
	}

	private extractId(item: T): string {
		if (!this.idField) {
			throw new Error("Cannot use CRUD methods without idField configured");
		}
		return String(item[this.idField]);
	}

	private async persist(): Promise<void> {
		if (!this.boundFile) {
			throw new Error("Cannot persist: no file bound. Call load() or loadFromRaw() first");
		}
		await this.write(this.boundFile.app, this.boundFile.file, this.sortedItems);
	}

	// --- Existing methods ---

	async extractRaw(vault: Vault, file: TFile): Promise<string | null> {
		try {
			const content = await vault.read(file);
			const regex = new RegExp(`\`\`\`${this.codeFence}\\n([\\s\\S]*?)\`\`\``, "");
			const match = content.match(regex);
			return match?.[1] ?? null;
		} catch (error) {
			console.debug(`Error reading file ${file.path}:`, error);
			return null;
		}
	}

	parse(raw: string): T[] {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.filter((item) => this.itemSchema.safeParse(item).success);
		} catch {
			return [];
		}
	}

	async read(vault: Vault, file: TFile): Promise<T[]> {
		const raw = await this.extractRaw(vault, file);
		if (raw === null) return [];
		return this.parse(raw);
	}

	serialize(entries: T[]): string {
		if (entries.length === 0) return "[]";
		const lines = entries.map((entry) => `  ${JSON.stringify(entry)}`);
		return `[\n${lines.join(",\n")}\n]`;
	}

	async write(app: App, file: TFile, entries: T[]): Promise<void> {
		const newContent = this.serialize(entries);
		await this.writeRaw(app, file, newContent);
	}

	async writeRaw(app: App, file: TFile, raw: string): Promise<void> {
		const activeView = app.workspace.getActiveViewOfType(MarkdownView);
		const shouldPreserveEditorState = activeView?.file?.path === file.path;

		const cursor = shouldPreserveEditorState ? activeView.editor.getCursor() : null;
		const scrollInfo = shouldPreserveEditorState ? activeView.editor.getScrollInfo() : null;

		const content = await app.vault.read(file);
		const updatedContent = content.replace(
			new RegExp(`\`\`\`${this.codeFence}\\n[\\s\\S]*?\`\`\``, ""),
			`\`\`\`${this.codeFence}\n${raw}\n\`\`\``
		);

		this.pendingSelfWrites++;
		await app.vault.modify(file, updatedContent);

		if (shouldPreserveEditorState && cursor && scrollInfo) {
			await new Promise<void>((resolve) => setTimeout(resolve, 0));
			requestAnimationFrame(() => {
				const viewAfter = app.workspace.getActiveViewOfType(MarkdownView);
				if (viewAfter?.file?.path !== file.path) return;

				viewAfter.editor.setCursor(cursor);
				viewAfter.editor.scrollTo(scrollInfo.left, scrollInfo.top);
			});
		}
	}

	async ensureBlock(app: App, file: TFile, defaultEntries?: T[]): Promise<void> {
		if (isFolderNote(file.path)) return;

		const content = await app.vault.read(file);
		if (content.includes(`\`\`\`${this.codeFence}`)) return;

		const serialized = defaultEntries ? this.serialize(defaultEntries) : "[]";
		const codeBlock = `\`\`\`${this.codeFence}\n${serialized}\n\`\`\`\n\n`;

		const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n?/);
		let updatedContent: string;
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[0];
			const rest = content.slice(frontmatter.length);
			updatedContent = `${frontmatter}\n${codeBlock}${rest}`;
		} else {
			updatedContent = `${codeBlock}${content}`;
		}

		await app.vault.modify(file, updatedContent);
	}
}
