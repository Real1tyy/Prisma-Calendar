import { type App, MarkdownView, TFile, type Vault } from "obsidian";
import type { z } from "zod";

import { isFolderNote } from "../file/file";
import { ensureDirectory } from "../file/file-utils";

export interface CodeBlockFileConfig<T> {
	codeFence: string;
	itemSchema: z.ZodType<T>;
}

/**
 * File I/O primitives for a fenced code block containing a JSON array of items.
 * Pure wrapper around Obsidian vault operations — no state beyond config.
 * CodeBlockRepository composes this to handle its disk interactions.
 */
export class CodeBlockFile<T> {
	private readonly codeFence: string;
	private readonly itemSchema: z.ZodType<T>;

	constructor(config: CodeBlockFileConfig<T>) {
		this.codeFence = config.codeFence;
		this.itemSchema = config.itemSchema;
	}

	// =========================================================================
	// File resolution / creation
	// =========================================================================

	resolveFile(app: App, filePath: string): TFile | null {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return null;
		return file;
	}

	async createBackingFile(app: App, filePath: string): Promise<TFile> {
		const existing = app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) return existing;

		const lastSlash = filePath.lastIndexOf("/");
		if (lastSlash > 0) {
			await ensureDirectory(app, filePath.substring(0, lastSlash));
		}
		const content = `\`\`\`${this.codeFence}\n[]\n\`\`\`\n`;
		try {
			return await app.vault.create(filePath, content);
		} catch {
			// TOCTOU: another caller created the file between the check and vault.create
			const retry = app.vault.getAbstractFileByPath(filePath);
			if (retry instanceof TFile) return retry;
			throw new Error(`Failed to create or resolve backing file at ${filePath}`);
		}
	}

	// =========================================================================
	// Parse / serialize
	// =========================================================================

	parse(raw: string): T[] {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed.filter((item) => this.itemSchema.safeParse(item).success);
		} catch {
			return [];
		}
	}

	serialize(entries: T[]): string {
		if (entries.length === 0) return "[]";
		const lines = entries.map((entry) => `  ${JSON.stringify(entry)}`);
		return `[\n${lines.join(",\n")}\n]`;
	}

	// =========================================================================
	// Read
	// =========================================================================

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

	async read(vault: Vault, file: TFile): Promise<T[]> {
		const raw = await this.extractRaw(vault, file);
		if (raw === null) return [];
		return this.parse(raw);
	}

	// =========================================================================
	// Write
	// =========================================================================

	/**
	 * Writes serialized entries to the bound code block.
	 * @param onBeforeWrite callback fired right before vault.modify — use it to
	 *   increment a self-write counter so external modify listeners can skip
	 *   reloads triggered by our own writes.
	 */
	async write(app: App, file: TFile, entries: T[], onBeforeWrite?: () => void): Promise<void> {
		const newContent = this.serialize(entries);
		await this.writeRaw(app, file, newContent, onBeforeWrite);
	}

	async writeRaw(app: App, file: TFile, raw: string, onBeforeWrite?: () => void): Promise<void> {
		const activeView = app.workspace.getActiveViewOfType(MarkdownView);
		const shouldPreserveEditorState = activeView?.file?.path === file.path;

		const cursor = shouldPreserveEditorState ? activeView.editor.getCursor() : null;
		const scrollInfo = shouldPreserveEditorState ? activeView.editor.getScrollInfo() : null;

		const content = await app.vault.read(file);
		const updatedContent = content.replace(
			new RegExp(`\`\`\`${this.codeFence}\\n[\\s\\S]*?\`\`\``, ""),
			`\`\`\`${this.codeFence}\n${raw}\n\`\`\``
		);

		onBeforeWrite?.();
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

	// =========================================================================
	// Ensure block exists in host file
	// =========================================================================

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
