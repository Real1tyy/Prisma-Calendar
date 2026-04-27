import { type App, normalizePath, Notice, TFile } from "obsidian";
import { parse as parseYAML } from "yaml";

import { createFileContentWithFrontmatter } from "../frontmatter/frontmatter-serialization";
import { ensureDirectory, waitForFileReady } from "./file-utils";

const TEMPLATER_ID = "templater-obsidian";

/**
 * Frontmatter key written into the sentinel file during atomic creation.
 * The indexer checks for this key (via metadataCache) to skip mid-write files
 * without performing any additional I/O.
 */
export const PENDING_WRITE_SENTINEL_FM_KEY = "pending_write";

export const PENDING_WRITE_SENTINEL_BODY_COMMENT = "pending-write";

/**
 * Full initial file content written during atomic creation.
 *
 * Must satisfy two constraints simultaneously:
 *  1. Frontmatter with PENDING_WRITE_SENTINEL_FM_KEY — lets the indexer detect
 *     and skip the file using the already-populated metadataCache (zero I/O).
 *  2. Non-empty body after the frontmatter — Templater's folder-template handler
 *     fires 300 ms after file creation and checks `content_size` (body length
 *     after frontmatter). content_size == 0 triggers the folder template; > 0
 *     sends it to overwrite_file_commands which is a no-op when the body has no
 *     Templater tags. Both frontmatter-only and empty files have content_size 0.
 */
export const PENDING_WRITE_SENTINEL = `---\n${PENDING_WRITE_SENTINEL_FM_KEY}: true\n---\n${PENDING_WRITE_SENTINEL_BODY_COMMENT}\n`;

// ============================================================================
// Types — legacy public API (create_new_note_from_template)
// ============================================================================

type CreateFn = (
	templateFile: TFile,
	folder?: string,
	filename?: string,
	openNewNote?: boolean
) => Promise<TFile | undefined>;

interface TemplaterLike {
	create_new_note_from_template: CreateFn;
}

// ============================================================================
// Types — internal API (read_and_parse_template)
// ============================================================================

interface RunningConfig {
	template_file: TFile | null;
	target_file: TFile;
	run_mode: number;
	active_file: TFile | null;
}

interface TemplaterInternalApi {
	// Reads the template file from disk, then renders it against target_file.
	// target_file must exist in the vault so Templater can resolve tp.file.* and
	// read the target's content/frontmatter if the template requests them.
	read_and_parse_template: (config: RunningConfig) => Promise<string>;

	// Set of file paths currently being processed by Templater.
	// Templater's folder-template handler (on_file_creation) checks this set
	// after a 300ms delay and skips the file entirely if present. Adding a path
	// here before vault.create prevents Templater from ever touching our file.
	files_with_pending_templates: Set<string>;
}

interface TemplaterPlugin {
	templater: TemplaterInternalApi;
}

// ============================================================================
// Shared options type
// ============================================================================

export interface FileCreationOptions {
	title: string;
	targetDirectory: string;
	filename?: string;
	content?: string;
	frontmatter?: Record<string, unknown>;
	templatePath?: string;
	useTemplater?: boolean;
}

// ============================================================================
// Internal helpers — legacy
// ============================================================================

async function waitForTemplater(app: App, timeoutMs = 8000): Promise<TemplaterLike | null> {
	await new Promise<void>((resolve) => app.workspace.onLayoutReady(resolve));

	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const appWithPlugins = app as App & {
			plugins?: { getPlugin?: (id: string) => { templater?: TemplaterLike } | null | undefined };
		};
		const plug = appWithPlugins.plugins?.getPlugin?.(TEMPLATER_ID) as { templater?: TemplaterLike } | null | undefined;
		const api = plug?.templater ?? null;

		const createFn: CreateFn | undefined = api?.create_new_note_from_template.bind(api);
		if (typeof createFn === "function") {
			return { create_new_note_from_template: createFn };
		}
		await new Promise((r) => setTimeout(r, 150));
	}
	return null;
}

// ============================================================================
// Internal helpers — atomic rendering
// ============================================================================

function getTemplaterPlugin(app: App): TemplaterPlugin | null {
	const appWithPlugins = app as App & {
		plugins?: { getPlugin?: (id: string) => TemplaterPlugin | null | undefined };
	};
	return appWithPlugins.plugins?.getPlugin?.(TEMPLATER_ID) ?? null;
}

/**
 * Registers a file path in Templater's files_with_pending_templates set so that
 * Templater's on_file_creation handler (folder-template / overwrite_file_commands)
 * skips the file entirely. Returns a cleanup function that removes the path after
 * Templater's 300ms handler window has safely passed.
 *
 * This is the same mechanism Templater uses internally (start_templater_task /
 * end_templater_task) and is the only way to fully prevent Templater from
 * touching a file we're managing ourselves.
 */
export function guardFromTemplater(app: App, filePath: string, releaseDelayMs = 500): () => void {
	const plugin = getTemplaterPlugin(app);
	const pending = plugin?.templater.files_with_pending_templates;
	if (pending) {
		pending.add(filePath);
	}
	return () => {
		// Hold the guard past Templater's 300ms delay + some margin, then release.
		setTimeout(() => {
			pending?.delete(filePath);
		}, releaseDelayMs);
	};
}

/**
 * Merges frontmatter overrides into processed template content. Overrides win.
 * Always strips PENDING_WRITE_SENTINEL_FM_KEY from the result — the template may
 * have inherited it from the target file's frontmatter via tp.file.frontmatter.
 */
function mergeTemplateContent(processedContent: string, overrides: Record<string, unknown>): string {
	const fmMatch = processedContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!fmMatch) {
		if (Object.keys(overrides).length === 0) {
			return processedContent;
		}
		return createFileContentWithFrontmatter(overrides, processedContent);
	}

	const rawTemplateFm = fmMatch[1];
	const body = fmMatch[2];
	const templateFm = parseYAML(rawTemplateFm) as Record<string, unknown>;

	const mergedFm = { ...templateFm, ...overrides };

	// Strip the sentinel key so it never ends up in the final written content
	delete mergedFm[PENDING_WRITE_SENTINEL_FM_KEY];

	return createFileContentWithFrontmatter(mergedFm, body);
}

// ============================================================================
// Public API — availability checks
// ============================================================================

export function isTemplaterAvailable(app: App): boolean {
	const appWithPlugins = app as App & {
		plugins?: { getPlugin?: (id: string) => unknown | null | undefined };
	};
	return !!appWithPlugins.plugins?.getPlugin?.(TEMPLATER_ID);
}

/**
 * Checks if a template should be used based on availability and file existence.
 */
export function shouldUseTemplate(app: App, templatePath: string | undefined): boolean {
	return !!(
		templatePath &&
		templatePath.trim() !== "" &&
		isTemplaterAvailable(app) &&
		app.vault.getFileByPath(templatePath)
	);
}

// ============================================================================
// Public API — atomic rendering (new)
// ============================================================================

/**
 * Renders a Templater template against an existing target file and returns the
 * fully processed content as a string, without any additional vault operations.
 *
 * targetFile must already exist in the vault (even as an empty file) so that
 * Templater can resolve tp.file.* functions and read the target's content from
 * the real filesystem path. Passing a non-existent file will cause Templater to
 * throw ENOENT when it accesses the target on disk.
 *
 * Any provided frontmatter overrides are merged on top of the template's own
 * frontmatter (overrides win).
 *
 * @returns The rendered content string, or null if Templater is unavailable,
 *          lacks the internal API, the template is missing, or rendering throws.
 */
export async function renderTemplateContent(
	app: App,
	templatePath: string,
	targetFile: TFile,
	overrides?: Record<string, unknown>
): Promise<string | null> {
	try {
		const plugin = getTemplaterPlugin(app);
		if (!plugin) {
			return null;
		}

		const templateFile = app.vault.getFileByPath(normalizePath(templatePath));
		if (!templateFile) {
			console.error(`[renderTemplateContent] Template not found: ${templatePath}`);
			return null;
		}

		const processedContent = await plugin.templater.read_and_parse_template({
			template_file: templateFile,
			target_file: targetFile,
			run_mode: 0, // RunMode.CreateNewFromTemplate
			active_file: null,
		});

		// Always merge (even with no overrides) so the sentinel key is stripped
		// from content if the template inherited it from the target file's frontmatter.
		return mergeTemplateContent(processedContent, overrides ?? {});
	} catch (error) {
		console.error("[renderTemplateContent] Error rendering template:", error);
		return null;
	}
}

// ============================================================================
// Internal helpers — body appending
// ============================================================================

/**
 * Appends extra body content after the rendered template body. Preserves
 * frontmatter intact and separates the two bodies with a blank line.
 * Returns the rendered content unchanged if extraBody is empty/whitespace.
 */
function appendBodyToRenderedContent(renderedContent: string, extraBody: string): string {
	const trimmedExtra = extraBody.trim();
	if (!trimmedExtra) {
		return renderedContent;
	}

	const fmMatch = renderedContent.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
	const renderedBody = fmMatch ? fmMatch[1] : renderedContent;
	const fmPart = fmMatch ? renderedContent.slice(0, renderedContent.length - renderedBody.length) : "";

	const trimmedRenderedBody = renderedBody.trimEnd();

	if (trimmedRenderedBody) {
		return `${fmPart}${trimmedRenderedBody}\n\n${trimmedExtra}\n`;
	}

	return `${fmPart}\n${trimmedExtra}\n`;
}

// ============================================================================
// Public API — atomic file creation at path
// ============================================================================

/**
 * Creates a file at the given path using the sentinel → guard → render → modify
 * pattern when a Templater template is configured. If content is provided
 * alongside a template, the template renders first and the content is appended
 * after the template body.
 *
 * Falls back to `createFileAtPath` (no Templater) when:
 *  - No template path is configured
 *  - Templater plugin is unavailable
 *  - Template file doesn't exist
 *
 * Falls back to frontmatter+content if rendering fails or returns null.
 */
export async function createFileAtPathAtomic(
	app: App,
	filePath: string,
	options: {
		content?: string;
		frontmatter?: Record<string, unknown>;
		templatePath?: string;
	}
): Promise<TFile> {
	const { content, frontmatter, templatePath } = options;

	if (!shouldUseTemplate(app, templatePath)) {
		return createFileAtPath(app, filePath, content, frontmatter);
	}

	const existing = app.vault.getAbstractFileByPath(filePath);
	if (existing instanceof TFile) {
		return existing;
	}

	const parentDir = filePath.substring(0, filePath.lastIndexOf("/"));
	if (parentDir) await ensureDirectory(app, parentDir);

	const releaseGuard = guardFromTemplater(app, filePath);
	let sentinelFile: TFile;
	try {
		sentinelFile = await app.vault.create(filePath, PENDING_WRITE_SENTINEL);
	} catch (err) {
		releaseGuard();
		if (err instanceof Error && err.message.includes("File already exists")) {
			const raced = app.vault.getAbstractFileByPath(filePath);
			if (raced instanceof TFile) return raced;
		}
		throw err;
	}

	try {
		const renderedContent = await renderTemplateContent(app, templatePath!, sentinelFile, frontmatter);

		if (renderedContent !== null) {
			const finalContent = content?.trim() ? appendBodyToRenderedContent(renderedContent, content) : renderedContent;
			await app.vault.modify(sentinelFile, finalContent);
			return sentinelFile;
		}
	} catch (err) {
		console.error("[createFileAtPathAtomic] renderTemplateContent threw:", err);
	} finally {
		releaseGuard();
	}

	// Rendering returned null or threw — write frontmatter-only content so
	// the file is still created correctly, just without the template body.
	const fallbackContent =
		frontmatter && Object.keys(frontmatter).length > 0
			? createFileContentWithFrontmatter(frontmatter, content || "")
			: content || "";
	await app.vault.modify(sentinelFile, fallbackContent);
	return sentinelFile;
}

// ============================================================================
// Public API — file creation
// ============================================================================

/**
 * Creates a file at the specified full path with optional frontmatter and content.
 * Returns existing file if it already exists.
 */
export async function createFileAtPath(
	app: App,
	filePath: string,
	content?: string,
	frontmatter?: Record<string, unknown>
): Promise<TFile> {
	const existingFile = app.vault.getAbstractFileByPath(filePath);
	if (existingFile instanceof TFile) {
		return existingFile;
	}

	const bodyContent = content || "";
	const fileContent =
		frontmatter && Object.keys(frontmatter).length > 0
			? createFileContentWithFrontmatter(frontmatter, bodyContent)
			: bodyContent;

	const parentDir = filePath.substring(0, filePath.lastIndexOf("/"));
	if (parentDir) await ensureDirectory(app, parentDir);

	// Prevent Templater's folder-template handler from overwriting our file.
	guardFromTemplater(app, filePath);

	try {
		return await app.vault.create(filePath, fileContent);
	} catch (err) {
		if (err instanceof Error && err.message.includes("File already exists")) {
			const raced = app.vault.getAbstractFileByPath(filePath);
			if (raced instanceof TFile) return raced;
		}
		throw err;
	}
}

/**
 * Creates a file manually with optional frontmatter and content.
 * Returns existing file if it already exists.
 */
export async function createFileManually(
	app: App,
	targetDirectory: string,
	filename: string,
	content?: string,
	frontmatter?: Record<string, unknown>
): Promise<TFile> {
	const baseName = filename.replace(/\.md$/, "");
	const filePath = `${targetDirectory}/${baseName}.md`;
	return createFileAtPath(app, filePath, content, frontmatter);
}

/**
 * Creates a file from a Templater template using Templater's public
 * create_new_note_from_template API.
 *
 * Note: this performs two vault writes (Templater creates the file, then we
 * apply frontmatter overrides), which can cause a brief race window with the
 * indexer. For atomic creation use TemplaterService.createFileAtomic().
 */
export async function createFromTemplate(
	app: App,
	templatePath: string,
	targetFolder?: string,
	filename?: string,
	openNewNote = false,
	frontmatter?: Record<string, unknown>
): Promise<TFile | null> {
	const templater = await waitForTemplater(app);
	if (!templater) {
		new Notice("Templater plugin is not available or enabled. Please ensure it is installed and enabled.");
		return null;
	}

	const templateFile = app.vault.getFileByPath(normalizePath(templatePath));
	if (!templateFile) {
		console.error(`[createFromTemplate] Template not found: ${templatePath}`);
		new Notice(`Template file not found: ${templatePath}. Please ensure the template file exists.`);
		return null;
	}

	try {
		const newFile = await templater.create_new_note_from_template(templateFile, targetFolder, filename, openNewNote);
		if (!newFile) {
			return null;
		}

		if (frontmatter && Object.keys(frontmatter).length > 0) {
			const readyFile = await waitForFileReady(app, newFile.path);
			if (readyFile) {
				await app.fileManager.processFrontMatter(readyFile, (fm) => {
					Object.assign(fm, frontmatter);
				});
				return readyFile;
			}
		}

		return newFile;
	} catch (error) {
		console.error("[createFromTemplate] Error creating file from template:", error);
		new Notice("Error creating file from template. Please ensure the template file is valid.");
		return null;
	}
}

export async function createFileWithTemplate(app: App, options: FileCreationOptions): Promise<TFile> {
	const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } = options;

	const finalFilename = filename || title;

	if (content) {
		return createFileManually(app, targetDirectory, finalFilename, content, frontmatter);
	}

	if (useTemplater && shouldUseTemplate(app, templatePath)) {
		const templateFile = await createFromTemplate(
			app,
			templatePath!,
			targetDirectory,
			finalFilename,
			false,
			frontmatter
		);

		if (templateFile) {
			return templateFile;
		}
	}

	return createFileManually(app, targetDirectory, finalFilename, content, frontmatter);
}
