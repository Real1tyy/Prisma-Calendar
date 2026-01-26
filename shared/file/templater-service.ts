import type { App, TFile } from "obsidian";
import type { FileCreationOptions } from "./templater";
import { createFileManually, createFromTemplate, isTemplaterAvailable, shouldUseTemplate } from "./templater";

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
	 * Creates a file using Templater or falls back to manual creation.
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
}
