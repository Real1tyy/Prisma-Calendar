import type { App, CachedMetadata } from "obsidian";
import { normalizePath, TFile } from "obsidian";

// ============================================================================
// File Path Operations
// ============================================================================

/**
 * Retrieves a TFile object from the vault by its path.
 * Handles path normalization using Obsidian's normalizePath utility.
 *
 * **Important**: Obsidian file paths ALWAYS include the `.md` extension.
 * The TFile.path property returns paths like "folder/file.md", not "folder/file".
 *
 * @param app - The Obsidian App instance
 * @param filePath - Path to the file (will be normalized, should include .md extension)
 * @returns TFile if found, null otherwise
 *
 * @example
 * ```ts
 * // Correct: Include .md extension
 * const file = getFileByPath(app, "folder/note.md");
 *
 * // For wikilinks without extension, add .md
 * const linkPath = "MyNote";
 * const file = getFileByPath(app, `${linkPath}.md`);
 * ```
 */
export function getFileByPath(app: App, filePath: string): TFile | null {
	// Normalize the path using Obsidian's utility
	// This handles slashes, spaces, and platform-specific path issues
	const normalizedPath = normalizePath(filePath);

	// Use Vault's direct lookup method (most efficient)
	// Prefer getFileByPath if available, otherwise use getAbstractFileByPath
	if (typeof app.vault.getFileByPath === "function") {
		return app.vault.getFileByPath(normalizedPath);
	}

	const abstractFile = app.vault.getAbstractFileByPath(normalizedPath);

	return abstractFile instanceof TFile ? abstractFile : null;
}

/**
 * Ensures a file path includes the .md extension.
 * Use this when working with wikilinks or user input that may omit extensions.
 *
 * @param path - File path that may or may not include .md extension
 * @returns Path guaranteed to end with .md
 *
 * @example
 * ```ts
 * ensureMarkdownExtension("MyNote") // "MyNote.md"
 * ensureMarkdownExtension("MyNote.md") // "MyNote.md"
 * ensureMarkdownExtension("folder/note") // "folder/note.md"
 * ```
 */
export function ensureMarkdownExtension(path: string): string {
	return path.endsWith(".md") ? path : `${path}.md`;
}

/**
 * Removes the .md extension from a file path if present.
 * Useful for displaying file names or creating wikilinks.
 *
 * @param path - File path that may include .md extension
 * @returns Path without .md extension
 *
 * @example
 * ```ts
 * removeMarkdownExtension("folder/note.md") // "folder/note"
 * removeMarkdownExtension("folder/note") // "folder/note"
 * ```
 */
export function removeMarkdownExtension(path: string): string {
	return path.endsWith(".md") ? path.slice(0, -3) : path;
}

// ============================================================================
// File Name Extraction
// ============================================================================

/**
 * Extracts the display name from a file path or wiki link.
 *
 * Handles various formats:
 * - `[[path/to/file|Alias]]` -> returns "Alias"
 * - `[[path/to/file]]` -> returns "file"
 * - `path/to/file.md` -> returns "file"
 * - `file.md` -> returns "file"
 *
 * @param input - File path or wiki link string
 * @returns The display name to show in the UI
 */
export function extractDisplayName(input: string): string {
	if (!input) return "";

	// Remove any surrounding whitespace
	const trimmed = input.trim();

	// Check if it's a wiki link format [[path|alias]] or [[path]]
	const wikiLinkMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);

	if (wikiLinkMatch) {
		const innerContent = wikiLinkMatch[1];

		// Check if there's an alias (pipe character)
		const pipeIndex = innerContent.indexOf("|");

		if (pipeIndex !== -1) {
			// Return the alias (everything after the pipe)
			return innerContent.substring(pipeIndex + 1).trim();
		}

		// No alias, extract filename from path
		const path = innerContent.trim();

		const lastSlashIndex = path.lastIndexOf("/");

		const filename = lastSlashIndex !== -1 ? path.substring(lastSlashIndex + 1) : path;

		return filename.replace(/\.md$/i, "");
	}

	// Not a wiki link, treat as regular path
	const lastSlashIndex = trimmed.lastIndexOf("/");

	const filename = lastSlashIndex !== -1 ? trimmed.substring(lastSlashIndex + 1) : trimmed;

	return filename.replace(/\.md$/i, "");
}

/**
 * Extracts the actual file path from a wiki link or returns the path as-is.
 *
 * Handles:
 * - `[[path/to/file|Alias]]` -> returns "path/to/file.md"
 * - `[[path/to/file]]` -> returns "path/to/file.md"
 * - `path/to/file.md` -> returns "path/to/file.md"
 *
 * @param input - File path or wiki link string
 * @returns The actual file path (with .md extension)
 */
export function extractFilePath(input: string): string {
	if (!input) return "";

	const trimmed = input.trim();

	// Check if it's a wiki link format [[path|alias]] or [[path]]
	const wikiLinkMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);

	if (wikiLinkMatch) {
		const innerContent = wikiLinkMatch[1];

		// Check if there's an alias (pipe character)
		const pipeIndex = innerContent.indexOf("|");

		const path = pipeIndex !== -1 ? innerContent.substring(0, pipeIndex).trim() : innerContent.trim();

		// Ensure .md extension
		return path.endsWith(".md") ? path : `${path}.md`;
	}

	// Not a wiki link, ensure .md extension
	return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
}

// ============================================================================
// File Context
// ============================================================================

export interface FileContext {
	path: string;
	pathWithExt: string;
	baseName: string;
	file: TFile | null;
	frontmatter: Record<string, unknown> | undefined;
	cache: CachedMetadata | null;
}

/**
 * Creates a comprehensive file context object containing all relevant file information.
 * Handles path normalization, file lookup, and metadata caching.
 */
export function getFileContext(app: App, path: string): FileContext {
	const pathWithExt = ensureMarkdownExtension(path);

	const baseName = removeMarkdownExtension(path);

	const file = getFileByPath(app, pathWithExt);

	const cache = file ? app.metadataCache.getFileCache(file) : null;

	const frontmatter = cache?.frontmatter;

	return {
		path,
		pathWithExt,
		baseName,
		file,
		frontmatter,
		cache,
	};
}

/**
 * Helper function to work with file context that automatically handles file not found cases.
 * Returns null if the file doesn't exist, otherwise executes the callback with the context.
 */
export async function withFileContext<T>(
	app: App,
	path: string,
	callback: (context: FileContext) => Promise<T> | T
): Promise<T | null> {
	const context = getFileContext(app, path);

	if (!context.file) {
		console.warn(`File not found: ${context.pathWithExt}`);
		return null;
	}

	return await callback(context);
}

// ============================================================================
// File Path Generation
// ============================================================================

/**
 * Generates a unique file path by appending a counter if the file already exists.
 * Automatically adds .md extension if not present.
 *
 * @param app - The Obsidian App instance
 * @param folder - Folder path (empty string for root, no trailing slash needed)
 * @param baseName - Base file name without extension
 * @returns Unique file path that doesn't exist in the vault
 *
 * @example
 * ```ts
 * // If "MyNote.md" exists, returns "MyNote 1.md"
 * const path = getUniqueFilePath(app, "", "MyNote");
 *
 * // With folder: "Projects/Task.md" -> "Projects/Task 1.md"
 * const path = getUniqueFilePath(app, "Projects", "Task");
 *
 * // Root folder handling
 * const path = getUniqueFilePath(app, "/", "Note"); // -> "Note.md"
 * ```
 */
export function getUniqueFilePath(app: App, folder: string, baseName: string): string {
	const normalizedFolder = folder && folder !== "/" ? folder : "";
	const folderPath = normalizedFolder ? `${normalizedFolder}/` : "";

	let fileName = `${baseName}.md`;
	let fullPath = `${folderPath}${fileName}`;
	let counter = 1;

	while (app.vault.getAbstractFileByPath(fullPath)) {
		fileName = `${baseName} ${counter}.md`;
		fullPath = `${folderPath}${fileName}`;
		counter++;
	}

	return fullPath;
}

/**
 * Generates a unique file path by appending a counter if the file already exists.
 * Accepts a complete file path and iterates with a counter suffix.
 *
 * @param app - The Obsidian App instance
 * @param filePath - Complete file path including folder, name, and extension
 * @returns Unique file path that doesn't exist in the vault
 *
 * @example
 * ```ts
 * // If "folder/note.md" exists, returns "folder/note 1.md"
 * const path = getUniqueFilePathFromFull(app, "folder/note.md");
 *
 * // Works with any extension
 * const path = getUniqueFilePathFromFull(app, "assets/image.png");
 * // -> "assets/image 1.png" if image.png exists
 * ```
 */
export const getUniqueFilePathFromFull = (app: App, filePath: string): string => {
	// If file doesn't exist, return as-is
	if (!app.vault.getAbstractFileByPath(filePath)) {
		return filePath;
	}

	// Extract folder, base name, and extension
	const lastSlashIndex = filePath.lastIndexOf("/");
	const folderPath = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex + 1) : "";
	const fileName = lastSlashIndex !== -1 ? filePath.substring(lastSlashIndex + 1) : filePath;

	const lastDotIndex = fileName.lastIndexOf(".");
	const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
	const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";

	let counter = 1;
	let uniquePath = `${folderPath}${baseName} ${counter}${extension}`;

	while (app.vault.getAbstractFileByPath(uniquePath)) {
		counter++;
		uniquePath = `${folderPath}${baseName} ${counter}${extension}`;
	}

	return uniquePath;
};

/**
 * Generates a unique file path by appending a counter if the file already exists.
 * Supports custom file extensions.
 *
 * @param app - The Obsidian App instance
 * @param folder - Folder path (empty string for root)
 * @param baseName - Base file name without extension
 * @param extension - File extension (defaults to "md")
 * @returns Unique file path that doesn't exist in the vault
 */
export const generateUniqueFilePath = (
	app: App,
	folder: string,
	baseName: string,
	extension: string = "md"
): string => {
	const folderPath = folder ? `${folder}/` : "";
	const fullPath = `${folderPath}${baseName}.${extension}`;
	return getUniqueFilePathFromFull(app, fullPath);
};

// ============================================================================
// Folder Note Operations
// ============================================================================

/**
 * Checks if a file is a folder note.
 * A folder note is a file whose name matches its parent folder name.
 *
 * @param filePath - Path to the file (e.g., "tasks/tasks.md")
 * @returns true if the file is a folder note, false otherwise
 *
 * @example
 * ```ts
 * isFolderNote("tasks/tasks.md") // true
 * isFolderNote("tasks/subtask.md") // false
 * isFolderNote("note.md") // false (no parent folder)
 * isFolderNote("projects/docs/docs.md") // true
 * ```
 */
export function isFolderNote(filePath: string): boolean {
	if (!filePath) return false;

	// Remove .md extension for comparison
	const pathWithoutExt = removeMarkdownExtension(filePath);

	// Split path into segments
	const segments = pathWithoutExt.split("/");

	// Need at least 2 segments (folder/file)
	if (segments.length < 2) return false;

	// Get the file name (last segment) and parent folder name (second to last)
	const fileName = segments[segments.length - 1];
	const parentFolderName = segments[segments.length - 2];

	// File is a folder note if its name matches the parent folder
	return fileName === parentFolderName;
}

/**
 * Gets the folder path for a file.
 *
 * @param filePath - Path to the file (e.g., "tasks/subtask.md")
 * @returns Folder path without trailing slash, or empty string if file is in root
 *
 * @example
 * ```ts
 * getFolderPath("tasks/subtask.md") // "tasks"
 * getFolderPath("projects/docs/notes.md") // "projects/docs"
 * getFolderPath("note.md") // ""
 * ```
 */
export function getFolderPath(filePath: string): string {
	if (!filePath) return "";

	const lastSlashIndex = filePath.lastIndexOf("/");

	if (lastSlashIndex === -1) return "";

	return filePath.substring(0, lastSlashIndex);
}

/**
 * Gets all markdown files in a specific folder (non-recursive).
 *
 * @param app - The Obsidian App instance
 * @param folderPath - Path to the folder (e.g., "tasks")
 * @returns Array of TFile objects in the folder
 *
 * @example
 * ```ts
 * const files = getFilesInFolder(app, "tasks");
 * // Returns [task1.md, task2.md, tasks.md] but not tasks/subtasks/file.md
 * ```
 */
export function getFilesInFolder(app: App, folderPath: string): TFile[] {
	const allFiles = app.vault.getMarkdownFiles();

	return allFiles.filter((file) => {
		const fileFolder = getFolderPath(file.path);

		return fileFolder === folderPath;
	});
}

/**
 * Gets all markdown files in a folder and its subfolders recursively.
 *
 * @param app - The Obsidian App instance
 * @param folderPath - Path to the folder (e.g., "tasks")
 * @returns Array of TFile objects in the folder tree
 *
 * @example
 * ```ts
 * const files = getAllFilesInFolderTree(app, "tasks");
 * // Returns all .md files in tasks/ and all its subdirectories
 * ```
 */
export function getAllFilesInFolderTree(app: App, folderPath: string): TFile[] {
	const allFiles = app.vault.getMarkdownFiles();

	const normalizedFolder = folderPath ? `${folderPath}/` : "";

	return allFiles.filter((file) => {
		if (!normalizedFolder) return true; // Root folder includes all files

		return file.path.startsWith(normalizedFolder);
	});
}

/**
 * Gets the parent file path based on folder structure.
 * For a file in a folder, the parent is the folder note if it exists.
 *
 * @param app - The Obsidian App instance
 * @param filePath - Path to the file
 * @returns Path to parent file, or null if no parent exists
 *
 * @example
 * ```ts
 * // If tasks/tasks.md exists
 * getParentByFolder(app, "tasks/subtask.md") // "tasks/tasks.md"
 *
 * // If parent folder note doesn't exist
 * getParentByFolder(app, "tasks/subtask.md") // null
 *
 * // Root level file
 * getParentByFolder(app, "note.md") // null
 * ```
 */
export function getParentByFolder(app: App, filePath: string): string | null {
	const folderPath = getFolderPath(filePath);

	if (!folderPath) return null; // File is at root level

	// Check if folder note exists
	const folderSegments = folderPath.split("/");

	const parentFolderName = folderSegments[folderSegments.length - 1];

	const potentialParentPath = `${folderPath}/${parentFolderName}.md`;

	const parentFile = getFileByPath(app, potentialParentPath);

	return parentFile ? potentialParentPath : null;
}

/**
 * Gets all child file paths based on folder structure.
 * Works for both folder notes and regular files.
 *
 * For folder notes (e.g., "tasks/tasks.md"):
 * - Returns all files directly in the folder (excluding the folder note)
 * - Includes subfolder notes one level down
 *
 * For regular files (e.g., "tasks/task1.md"):
 * - Returns the folder note from matching subfolder if it exists (e.g., "tasks/task1/task1.md")
 *
 * @param app - The Obsidian App instance
 * @param filePath - Path to the file
 * @returns Array of child file paths
 *
 * @example
 * ```ts
 * // For tasks/tasks.md (folder note)
 * getChildrenByFolder(app, "tasks/tasks.md")
 * // Returns ["tasks/task1.md", "tasks/task2.md", "tasks/subtasks/subtasks.md"]
 *
 * // For tasks/task1.md (regular file with matching subfolder)
 * getChildrenByFolder(app, "tasks/task1.md")
 * // Returns ["tasks/task1/task1.md"] if it exists
 * ```
 */
export function getChildrenByFolder(app: App, filePath: string): string[] {
	const allFiles = app.vault.getMarkdownFiles();

	// Case 1: Folder note - get all files in the folder
	if (isFolderNote(filePath)) {
		const folderPath = getFolderPath(filePath);

		const children: string[] = [];

		allFiles.forEach((file) => {
			// Skip the folder note itself
			if (file.path === filePath) return;

			const fileFolder = getFolderPath(file.path);

			// Direct child: file is in the same folder as the folder note
			if (fileFolder === folderPath) {
				children.push(file.path);

				return;
			}

			// Subfolder note: file is a folder note one level deeper
			// e.g., for "tasks/tasks.md", include "tasks/subtasks/subtasks.md"
			if (fileFolder.startsWith(`${folderPath}/`)) {
				// Check if it's exactly one level deeper and is a folder note
				const relativePath = fileFolder.substring(folderPath.length + 1);

				const isOneLevel = !relativePath.includes("/");

				if (isOneLevel && isFolderNote(file.path)) {
					children.push(file.path);
				}
			}
		});

		return children;
	}

	// Case 2: Regular file - check for matching subfolder with folder note
	const pathWithoutExt = removeMarkdownExtension(filePath);

	const fileName = pathWithoutExt.split("/").pop() || "";

	const potentialChildFolder = `${pathWithoutExt}`;

	const potentialChildPath = `${potentialChildFolder}/${fileName}.md`;

	// Check if the child folder note exists
	const childFile = getFileByPath(app, potentialChildPath);

	return childFile ? [potentialChildPath] : [];
}

/**
 * Finds all root nodes in a folder tree.
 * Root nodes are files at the top level of the folder (directly in the folder, not in subfolders).
 *
 * @param app - The Obsidian App instance
 * @param folderPath - Path to the folder
 * @returns Array of root file paths
 *
 * @example
 * ```ts
 * // For folder structure:
 * // tasks/
 * //   tasks.md (folder note)
 * //   task1.md
 * //   subtasks/
 * //     subtasks.md
 * //     subtask1.md
 *
 * findRootNodesInFolder(app, "tasks")
 * // Returns ["tasks/tasks.md", "tasks/task1.md"]
 * // Excludes subtasks/subtasks.md and subtasks/subtask1.md (they're in subfolder)
 * ```
 */
export function findRootNodesInFolder(app: App, folderPath: string): string[] {
	return getFilesInFolder(app, folderPath).map((file) => file.path);
}

// ============================================================================
// Filename Sanitization
// ============================================================================

export interface SanitizeFilenameOptions {
	/**
	 * Style of sanitization to apply.
	 * - "kebab": Convert to lowercase, replace spaces with hyphens (default, backwards compatible)
	 * - "preserve": Preserve spaces and case, only remove invalid characters
	 */
	style?: "kebab" | "preserve";
}

/**
 * Sanitizes a string for use as a filename.
 * Defaults to kebab-case style for backwards compatibility.
 *
 * @param input - String to sanitize
 * @param options - Sanitization options
 * @returns Sanitized filename string
 *
 * @example
 * // Default kebab-case style (backwards compatible)
 * sanitizeForFilename("My File Name") // "my-file-name"
 *
 * // Preserve spaces and case
 * sanitizeForFilename("My File Name", { style: "preserve" }) // "My File Name"
 */
export const sanitizeForFilename = (input: string, options: SanitizeFilenameOptions = {}): string => {
	const { style = "kebab" } = options;

	if (style === "preserve") {
		return sanitizeFilenamePreserveSpaces(input);
	}

	// Default: kebab-case style (legacy behavior)
	return sanitizeFilenameKebabCase(input);
};

/**
 * Sanitizes filename using kebab-case style.
 * - Removes invalid characters
 * - Converts to lowercase
 * - Replaces spaces with hyphens
 *
 * Best for: CLI tools, URLs, slugs, technical files
 *
 * @example
 * sanitizeFilenameKebabCase("My File Name") // "my-file-name"
 * sanitizeFilenameKebabCase("Travel Around The World") // "travel-around-the-world"
 */
export const sanitizeFilenameKebabCase = (input: string): string => {
	return (
		input
			// Remove invalid filename characters
			.replace(/[<>:"/\\|?*]/g, "")
			// Replace spaces with hyphens
			.replace(/\s+/g, "-")
			// Replace multiple hyphens with single
			.replace(/-+/g, "-")
			// Remove leading/trailing hyphens
			.replace(/^-|-$/g, "")
			// Convert to lowercase
			.toLowerCase()
	);
};

/**
 * Sanitizes filename while preserving spaces and case.
 * - Removes invalid characters only
 * - Preserves spaces and original casing
 * - Removes trailing dots (Windows compatibility)
 *
 * Best for: Note titles, human-readable filenames, Obsidian notes
 *
 * @example
 * sanitizeFilenamePreserveSpaces("My File Name") // "My File Name"
 * sanitizeFilenamePreserveSpaces("Travel Around The World") // "Travel Around The World"
 * sanitizeFilenamePreserveSpaces("File<Invalid>Chars") // "FileInvalidChars"
 */
export const sanitizeFilenamePreserveSpaces = (input: string): string => {
	return (
		input
			// Remove invalid filename characters (cross-platform compatibility)
			.replace(/[<>:"/\\|?*]/g, "")
			// Remove trailing dots (invalid on Windows)
			.replace(/\.+$/g, "")
			// Remove leading/trailing whitespace
			.trim()
	);
};

export const getFilenameFromPath = (filePath: string): string => {
	return filePath.split("/").pop() || "Unknown";
};

export const isFileInConfiguredDirectory = (filePath: string, directory: string): boolean => {
	const normalizedDir = directory.endsWith("/") ? directory.slice(0, -1) : directory;
	return filePath.startsWith(`${normalizedDir}/`) || filePath === normalizedDir;
};
