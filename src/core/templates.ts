import { generateUniqueFilePath } from "@real1ty-obsidian-plugins/utils/file-utils";
import { createFromTemplate, isTemplaterAvailable } from "@real1ty-obsidian-plugins/utils/templater-utils";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import type { SingleCalendarConfig } from "../types/settings";
import type { Indexer, IndexerEvent } from "./indexer";

export interface FileCreationOptions {
	title: string;
	targetDirectory: string;
	filename?: string;
	content?: string;
	/** Frontmatter to apply when indexer picks up the file */
	frontmatter?: Record<string, unknown>;
}

export class TemplateService {
	private settings: SingleCalendarConfig;
	private settingsSubscription: Subscription | null = null;
	private indexerSubscription: Subscription | null = null;

	/**
	 * Files awaiting frontmatter application when indexer picks them up.
	 * Maps file path -> frontmatter to apply
	 */
	private pendingFrontmatter: Map<string, Record<string, unknown>> = new Map();

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		indexer: Indexer
	) {
		this.settings = settingsStore.value;
		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});

		this.indexerSubscription = indexer.events$.subscribe((event: IndexerEvent) => {
			this.handleIndexerEvent(event);
		});
	}

	private async handleIndexerEvent(event: IndexerEvent): Promise<void> {
		if (event.type !== "file-changed") return;

		const frontmatter = this.pendingFrontmatter.get(event.filePath);
		if (!frontmatter) return;

		this.pendingFrontmatter.delete(event.filePath);

		try {
			const file = this.app.vault.getAbstractFileByPath(event.filePath);
			if (file instanceof TFile) {
				await this.app.fileManager.processFrontMatter(file, (fm) => {
					Object.assign(fm, frontmatter);
				});
			}
		} catch (error) {
			console.error(`[Template Service] ❌ Error applying frontmatter:`, error);
		}
	}

	destroy(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.indexerSubscription?.unsubscribe();
		this.indexerSubscription = null;
		this.pendingFrontmatter.clear();
	}

	async createFile(options: FileCreationOptions): Promise<TFile> {
		const { title, targetDirectory, filename, content, frontmatter } = options;

		const finalFilename = filename || title;

		// If content is provided (e.g., for recurring event instances), use manual creation
		// to preserve the inherited content instead of using templates
		if (content) {
			return this.createManually(title, targetDirectory, finalFilename, content);
		}

		if (this.shouldUseTemplate()) {
			const templateFile = await this.createFromTemplate(targetDirectory, finalFilename);
			if (templateFile) {
				// If frontmatter needs to be applied, register it for when indexer picks up the file
				if (frontmatter && Object.keys(frontmatter).length > 0) {
					this.pendingFrontmatter.set(templateFile.path, frontmatter);
				}

				return templateFile;
			}
		}

		// Fallback to manual creation
		return this.createManually(title, targetDirectory, finalFilename, content);
	}

	private shouldUseTemplate(): boolean {
		return !!(
			this.settings.templatePath &&
			isTemplaterAvailable(this.app) &&
			!!this.app.vault.getFileByPath(this.settings.templatePath)
		);
	}

	private async createFromTemplate(targetDirectory: string, filename: string): Promise<TFile | null> {
		if (!this.settings.templatePath) return null;

		try {
			const templateFile = await createFromTemplate(this.app, this.settings.templatePath, targetDirectory, filename);

			if (templateFile) {
				return templateFile;
			}
		} catch (error) {
			console.error("Error creating file from template:", error);
		}

		return null;
	}

	private async createManually(
		title: string,
		targetDirectory: string,
		filename: string,
		customContent?: string
	): Promise<TFile> {
		// Generate unique file path to avoid conflicts
		const filePath = generateUniqueFilePath(this.app, targetDirectory, filename);

		// Use custom content or default
		const content = customContent || `# ${title}\n\n`;

		const file = await this.app.vault.create(filePath, content);

		return file;
	}
}
