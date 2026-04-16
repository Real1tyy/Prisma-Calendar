import { vi } from "vitest";
import { parse as parseYAML } from "yaml";

import { createFileContentWithFrontmatter, parseFileContent } from "../../core/frontmatter/frontmatter-serialization";
import { createEventEmitter, type EventEmitter } from "../event-emitter";
import { TFile, TFolder } from "../mocks/obsidian";

// ─── Types ───────────────────────────────────────────────────────

type SeedValue = string | { content: string; frontmatter?: Record<string, unknown> };

interface FileEntry {
	file: InstanceType<typeof TFile>;
	content: string;
	frontmatter: Record<string, unknown>;
}

interface FakeVaultOptions {
	/** Seed the vault with initial files. Values may be raw content or `{ content, frontmatter }` objects. */
	files?: Record<string, SeedValue>;
}

interface FakeAppResult {
	vault: FakeVaultInstance;
	metadataCache: FakeMetadataCache;
	fileManager: FakeFileManager;
	workspace: FakeWorkspace;
}

interface FakeVaultInstance extends EventEmitter {
	getAbstractFileByPath: (path: string) => InstanceType<typeof TFile> | InstanceType<typeof TFolder> | null;
	getFileByPath: (path: string) => InstanceType<typeof TFile> | null;
	getFolderByPath: (path: string) => InstanceType<typeof TFolder> | null;
	getFiles: () => InstanceType<typeof TFile>[];
	getMarkdownFiles: () => InstanceType<typeof TFile>[];
	read: (file: InstanceType<typeof TFile>) => Promise<string>;
	cachedRead: (file: InstanceType<typeof TFile>) => Promise<string>;
	modify: (file: InstanceType<typeof TFile>, content: string) => Promise<void>;
	create: (path: string, content: string) => Promise<InstanceType<typeof TFile>>;
	createFolder: (path: string) => Promise<InstanceType<typeof TFolder>>;
	delete: (file: InstanceType<typeof TFile>) => Promise<void>;
	rename: (file: InstanceType<typeof TFile>, newPath: string) => Promise<void>;
}

interface FakeMetadataCache extends EventEmitter {
	getFileCache: (file: InstanceType<typeof TFile>) => ReturnType<typeof buildCacheEntry> | null;
}

interface FakeFileManager {
	processFrontMatter: (
		file: InstanceType<typeof TFile>,
		fn: (frontmatter: Record<string, unknown>) => void
	) => Promise<void>;
	renameFile: ReturnType<typeof vi.fn>;
}

interface FakeWorkspace extends EventEmitter {
	getActiveFile: ReturnType<typeof vi.fn>;
	onLayoutReady: (callback: () => void) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────

function parseFrontmatterFromContent(content: string): Record<string, unknown> {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!match) return {};
	return (parseYAML(match[1]) ?? {}) as Record<string, unknown>;
}

function buildCacheEntry(frontmatter: Record<string, unknown>) {
	const keys = Object.keys(frontmatter);
	const empty = keys.length === 0;

	return {
		frontmatter: empty
			? undefined
			: { ...frontmatter, position: { start: { line: 0 }, end: { line: keys.length + 1 } } },
		frontmatterPosition: empty
			? undefined
			: { start: { line: 0, col: 0, offset: 0 }, end: { line: keys.length + 1, col: 3, offset: 0 } },
		sections: [],
		headings: [],
		links: [],
		embeds: [],
		tags: [],
		listItems: [],
	};
}

function resolveSeedValue(value: SeedValue): { content: string; frontmatter: Record<string, unknown> } {
	if (typeof value === "string") {
		return { content: value, frontmatter: parseFrontmatterFromContent(value) };
	}
	const explicit = value.frontmatter ?? {};
	const frontmatter = Object.keys(explicit).length > 0 ? explicit : parseFrontmatterFromContent(value.content);
	return { content: value.content, frontmatter };
}

// ─── FakeApp Factory ─────────────────────────────────────────────

/**
 * Creates an in-memory Obsidian App with real read/write/rename/delete semantics.
 *
 * Unlike `createMockApp()` which uses `vi.fn()` everywhere, FakeApp maintains actual
 * file state so that `vault.read()` returns content written by `vault.modify()`,
 * `vault.getFiles()` reflects created/deleted files, and events fire automatically.
 *
 * @example
 * ```ts
 * const app = createFakeApp({
 *   files: {
 *     "Events/meeting.md": "---\nTitle: Team Meeting\n---\nNotes",
 *     "Events/workout.md": { content: "# Workout", frontmatter: { Title: "Workout" } },
 *   },
 * });
 * ```
 */
export function createFakeApp(options: FakeVaultOptions = {}): FakeAppResult {
	const files = new Map<string, FileEntry>();
	const folders = new Set<string>();

	const vaultEvents = createEventEmitter();
	const metadataCacheEvents = createEventEmitter();
	const workspaceEvents = createEventEmitter();

	function ensureParentFolders(filePath: string): void {
		const parts = filePath.split("/");
		for (let i = 1; i < parts.length; i++) {
			folders.add(parts.slice(0, i).join("/"));
		}
	}

	function getFileEntry(file: InstanceType<typeof TFile>): FileEntry {
		const entry = files.get(file.path);
		if (!entry) throw new Error(`FakeVault: file not found: ${file.path}`);
		return entry;
	}

	function setFileEntry(path: string, content: string, frontmatter: Record<string, unknown>): FileEntry {
		const entry: FileEntry = { file: new TFile(path), content, frontmatter };
		files.set(path, entry);
		ensureParentFolders(path);
		return entry;
	}

	for (const [path, value] of Object.entries(options.files ?? {})) {
		const { content, frontmatter } = resolveSeedValue(value);
		setFileEntry(path, content, { ...frontmatter });
	}

	const vault: FakeVaultInstance = {
		...vaultEvents,

		getAbstractFileByPath(path) {
			const fileEntry = files.get(path);
			if (fileEntry) return fileEntry.file;
			if (folders.has(path)) return new TFolder(path);
			return null;
		},

		getFileByPath(path) {
			return files.get(path)?.file ?? null;
		},

		getFolderByPath(path) {
			return folders.has(path) ? new TFolder(path) : null;
		},

		getFiles() {
			return [...files.values()].map((e) => e.file);
		},

		getMarkdownFiles() {
			return [...files.values()].filter((e) => e.file.extension === "md").map((e) => e.file);
		},

		async read(file) {
			return getFileEntry(file).content;
		},

		async cachedRead(file) {
			return getFileEntry(file).content;
		},

		async modify(file, content) {
			const entry = getFileEntry(file);
			entry.content = content;
			entry.frontmatter = parseFrontmatterFromContent(content);

			vaultEvents.trigger("modify", file);
			metadataCacheEvents.trigger("changed", file, content, buildCacheEntry(entry.frontmatter));
		},

		async create(path, content) {
			if (files.has(path)) throw new Error(`FakeVault: file already exists: ${path}`);

			const entry = setFileEntry(path, content, parseFrontmatterFromContent(content));

			vaultEvents.trigger("create", entry.file);
			metadataCacheEvents.trigger("changed", entry.file, content, buildCacheEntry(entry.frontmatter));
			return entry.file;
		},

		async createFolder(path) {
			folders.add(path);
			const folder = new TFolder(path);
			vaultEvents.trigger("create", folder);
			return folder;
		},

		async delete(file) {
			if (!files.has(file.path)) throw new Error(`FakeVault: file not found: ${file.path}`);
			files.delete(file.path);
			vaultEvents.trigger("delete", file);
		},

		async rename(file, newPath) {
			const entry = getFileEntry(file);
			const oldPath = file.path;

			files.delete(oldPath);
			file.path = newPath;
			file.name = newPath.split("/").pop() || "";
			file.basename = file.name.replace(/\.[^/.]+$/, "");
			file.extension = newPath.split(".").pop() || "md";

			files.set(newPath, entry);
			ensureParentFolders(newPath);

			vaultEvents.trigger("rename", file, oldPath);
		},
	};

	const metadataCache: FakeMetadataCache = {
		...metadataCacheEvents,

		getFileCache(file) {
			const entry = files.get(file.path);
			return entry ? buildCacheEntry(entry.frontmatter) : null;
		},
	};

	const fileManager: FakeFileManager = {
		async processFrontMatter(file, fn) {
			const entry = getFileEntry(file);
			fn(entry.frontmatter);

			const { body } = parseFileContent(entry.content);
			entry.content = createFileContentWithFrontmatter(entry.frontmatter, body);

			metadataCacheEvents.trigger("changed", file, entry.content, buildCacheEntry(entry.frontmatter));
		},

		renameFile: vi.fn().mockResolvedValue(undefined),
	};

	const workspace: FakeWorkspace = {
		...workspaceEvents,

		getActiveFile: vi.fn().mockReturnValue(null),
		onLayoutReady(callback) {
			callback();
		},
	};

	return { vault, metadataCache, fileManager, workspace };
}

export type { FakeAppResult, FakeFileManager, FakeMetadataCache, FakeVaultInstance, FakeVaultOptions, FakeWorkspace };
