import { type App, Notice, normalizePath, TFile } from "obsidian";
import { waitForFileReady } from "./file-utils";
import { createFileContentWithFrontmatter } from "./frontmatter-serialization";

const TEMPLATER_ID = "templater-obsidian";

type CreateFn = (
	templateFile: TFile,
	folder?: string,
	filename?: string,
	openNewNote?: boolean
) => Promise<TFile | undefined>;

interface TemplaterLike {
	create_new_note_from_template: CreateFn;
}

export interface FileCreationOptions {
	title: string;
	targetDirectory: string;
	filename?: string;
	content?: string;
	frontmatter?: Record<string, unknown>;
	templatePath?: string;
	useTemplater?: boolean;
}

async function waitForTemplater(app: App, timeoutMs = 8000): Promise<TemplaterLike | null> {
	await new Promise<void>((resolve) => app.workspace.onLayoutReady(resolve));

	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const appWithPlugins = app as App & {
			plugins?: { getPlugin?: (id: string) => { templater?: TemplaterLike } | null | undefined };
		};
		const plug = appWithPlugins.plugins?.getPlugin?.(TEMPLATER_ID) as { templater?: TemplaterLike } | null | undefined;
		const api = plug?.templater ?? null;

		const createFn: CreateFn | undefined = api?.create_new_note_from_template?.bind(api);
		if (typeof createFn === "function") {
			return { create_new_note_from_template: createFn };
		}
		await new Promise((r) => setTimeout(r, 150));
	}
	return null;
}

export function isTemplaterAvailable(app: App): boolean {
	const appWithPlugins = app as App & {
		plugins?: { getPlugin?: (id: string) => unknown | null | undefined };
	};
	const instance = appWithPlugins.plugins?.getPlugin?.(TEMPLATER_ID);
	return !!instance;
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
	// Check if file already exists
	const existingFile = app.vault.getAbstractFileByPath(filePath);
	if (existingFile instanceof TFile) {
		return existingFile;
	}

	const bodyContent = content || "";

	let fileContent: string;
	if (frontmatter && Object.keys(frontmatter).length > 0) {
		fileContent = createFileContentWithFrontmatter(frontmatter, bodyContent);
	} else {
		fileContent = bodyContent;
	}

	const file = await app.vault.create(filePath, fileContent);
	return file;
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
		console.warn("Templater isn't ready yet (or not installed/enabled).");
		new Notice("Templater plugin is not available or enabled. Please ensure it is installed and enabled.");
		return null;
	}

	const templateFile = app.vault.getFileByPath(normalizePath(templatePath));
	if (!templateFile) {
		console.error(`Template not found: ${templatePath}`);
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
		console.error("Error creating file from template:", error);
		new Notice("Error creating file from template. Please ensure the template file is valid.");
		return null;
	}
}

export async function createFileWithTemplate(app: App, options: FileCreationOptions): Promise<TFile> {
	const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } = options;

	const finalFilename = filename || title;

	// If content is provided, use manual creation to preserve the content
	if (content) {
		return createFileManually(app, targetDirectory, finalFilename, content, frontmatter);
	}

	// Try to use template if requested and available
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
