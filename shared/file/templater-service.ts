import type { App } from "obsidian";
import type { TFile } from "obsidian";

import type { FileCreationOptions } from "./templater";
import {
	createFileAtPathAtomic,
	createFileManually,
	createFromTemplate,
	isTemplaterAvailable,
	renderTemplateContent,
	shouldUseTemplate,
} from "./templater";

export type { FileCreationOptions };

// ============================================================================
// Templater Service (Class-based wrapper)
// ============================================================================

export class TemplaterService {
	constructor(private app: App) {}

	/**
	 * Checks if Templater plugin is installed and enabled.
	 */
	isAvailable(): boolean {
		return isTemplaterAvailable(this.app);
	}

	/**
	 * Renders a Templater template against an existing target file and returns
	 * the fully processed content as a string, without any additional vault
	 * operations.
	 *
	 * targetFile must already exist in the vault (even as an empty file) so that
	 * Templater can resolve tp.file.* functions correctly from the real path.
	 * The caller is then responsible for writing the returned content to the file.
	 *
	 * Any provided frontmatter overrides are merged on top of the template's own
	 * frontmatter (overrides win).
	 *
	 * Returns null if Templater is unavailable, the template is missing, or
	 * rendering fails.
	 */
	async renderTemplate(
		templatePath: string,
		targetFile: TFile,
		overrides?: Record<string, unknown>
	): Promise<string | null> {
		return renderTemplateContent(this.app, templatePath, targetFile, overrides);
	}

	/**
	 * Creates a file using Templater's public create_new_note_from_template API,
	 * or falls back to manual creation.
	 *
	 * This performs two vault writes when a template is used (Templater writes
	 * the file, then frontmatter overrides are applied). For atomic single-write
	 * creation use createFileAtomic instead.
	 */
	async createFile(options: FileCreationOptions): Promise<TFile> {
		const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } = options;

		const finalFilename = filename || title;

		if (content) {
			return createFileManually(this.app, targetDirectory, finalFilename, content, frontmatter);
		}

		if (useTemplater && shouldUseTemplate(this.app, templatePath)) {
			const templateFile = await createFromTemplate(
				this.app,
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
		// Fallback to manual creation
		return createFileManually(this.app, targetDirectory, finalFilename, content, frontmatter);
	}

	/**
	 * Creates a file using Templater's internal read_and_parse_template API for
	 * atomic creation, eliminating the race condition with the indexer and
	 * Templater's folder-template handler.
	 *
	 * When a template is configured and content is also provided, the template
	 * renders first and the content is appended after the template body.
	 *
	 * Falls back to manual creation if Templater is unavailable or rendering fails.
	 */
	async createFileAtomic(options: FileCreationOptions): Promise<TFile> {
		const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } = options;

		const finalFilename = filename || title;
		const baseName = finalFilename.replace(/\.md$/, "");
		const filePath = `${targetDirectory}/${baseName}.md`;

		if (useTemplater) {
			return createFileAtPathAtomic(this.app, filePath, {
				...(content !== undefined ? { content } : {}),
				...(frontmatter !== undefined ? { frontmatter } : {}),
				...(templatePath !== undefined ? { templatePath } : {}),
			});
		}

		return createFileManually(this.app, targetDirectory, finalFilename, content, frontmatter);
	}
}
