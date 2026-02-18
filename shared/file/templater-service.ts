import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { FileCreationOptions } from "./templater";
import { createFileContentWithFrontmatter } from "./frontmatter-serialization";
import {
	PENDING_WRITE_SENTINEL,
	createFileManually,
	createFromTemplate,
	guardFromTemplater,
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
	 * The flow:
	 *  1. Register the target path in Templater's files_with_pending_templates
	 *     set so its on_file_creation handler skips this file entirely.
	 *  2. Create a sentinel file (so Templater can read it during rendering).
	 *  3. Render the template via read_and_parse_template, merge frontmatter.
	 *  4. Write the final content with vault.modify — the indexer only sees the
	 *     complete, correct file state.
	 *
	 * Falls back to manual creation if Templater is unavailable or rendering fails.
	 */
	async createFileAtomic(options: FileCreationOptions): Promise<TFile> {
		const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } = options;

		const finalFilename = filename || title;

		if (content) {
			return createFileManually(this.app, targetDirectory, finalFilename, content, frontmatter);
		}

		if (useTemplater && shouldUseTemplate(this.app, templatePath)) {
			const baseName = finalFilename.replace(/\.md$/, "");
			const filePath = `${targetDirectory}/${baseName}.md`;

			// Guard: return existing file rather than overwrite
			const existing = this.app.vault.getAbstractFileByPath(filePath);
			if (existing instanceof TFile) {
				return existing;
			}

			// Register the path in Templater's files_with_pending_templates set
			// BEFORE creating the file. Templater's on_file_creation handler checks
			// this set (after a 300ms delay) and returns immediately if the path is
			// present — preventing both folder-template application AND the
			// overwrite_file_commands branch from running.
			const releaseGuard = guardFromTemplater(this.app, filePath);

			// Create sentinel so Templater can read it during read_and_parse_template
			// (tp.file.content is eagerly evaluated and requires the file on disk).
			const sentinelFile = await this.app.vault.create(filePath, PENDING_WRITE_SENTINEL);

			try {
				const renderedContent = await renderTemplateContent(this.app, templatePath!, sentinelFile, frontmatter);

				if (renderedContent !== null) {
					await this.app.vault.modify(sentinelFile, renderedContent);
					return sentinelFile;
				}
			} catch (err) {
				console.error("[createFileAtomic] renderTemplateContent threw:", err);
			} finally {
				releaseGuard();
			}

			// Rendering returned null or threw — write frontmatter-only content so
			// the event is still created correctly, just without the template body.
			const fallbackContent = frontmatter ? createFileContentWithFrontmatter(frontmatter, "") : "";
			await this.app.vault.modify(sentinelFile, fallbackContent);
			return sentinelFile;
		}

		return createFileManually(this.app, targetDirectory, finalFilename, content, frontmatter);
	}
}
