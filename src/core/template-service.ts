import { generateUniqueFilePath } from "@real1ty-obsidian-plugins/utils/file-utils";
import {
	createFromTemplate,
	isTemplaterAvailable,
} from "@real1ty-obsidian-plugins/utils/templater-utils";
import type { App, TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import type { SingleCalendarConfig } from "../types/settings-schemas";

export interface FileCreationOptions {
	title: string;
	targetDirectory: string;
	filename?: string;
	content?: string;
}

export class TemplateService {
	private settings: SingleCalendarConfig;
	private settingsSubscription: Subscription | null = null;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this.settings = settingsStore.value;
		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});
	}

	destroy(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
	}

	async createFile(options: FileCreationOptions): Promise<TFile> {
		const { title, targetDirectory, filename, content } = options;

		const finalFilename = filename || title;

		// If content is provided (e.g., for recurring event instances), use manual creation
		// to preserve the inherited content instead of using templates
		if (content) {
			return this.createManually(title, targetDirectory, finalFilename, content);
		}

		if (this.shouldUseTemplate()) {
			const templateFile = await this.createFromTemplate(targetDirectory, finalFilename);
			if (templateFile) {
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

	private async createFromTemplate(
		targetDirectory: string,
		filename: string
	): Promise<TFile | null> {
		if (!this.settings.templatePath) return null;

		try {
			const templateFile = await createFromTemplate(
				this.app,
				this.settings.templatePath,
				targetDirectory,
				filename
			);

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
