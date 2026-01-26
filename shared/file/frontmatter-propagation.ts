import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { Frontmatter, FrontmatterDiff } from "./frontmatter-diff";

export async function applyFrontmatterChanges(
	app: App,
	targetPath: string,
	sourceFrontmatter: Frontmatter,
	diff: FrontmatterDiff
): Promise<void> {
	try {
		const file = app.vault.getAbstractFileByPath(targetPath);
		if (!(file instanceof TFile)) {
			console.warn(`Target file not found: ${targetPath}`);
			return;
		}

		await app.fileManager.processFrontMatter(file, (fm) => {
			for (const change of diff.added) {
				fm[change.key] = sourceFrontmatter[change.key];
			}

			for (const change of diff.modified) {
				fm[change.key] = sourceFrontmatter[change.key];
			}

			for (const change of diff.deleted) {
				delete fm[change.key];
			}
		});
	} catch (error) {
		console.error(`Error applying frontmatter changes to ${targetPath}:`, error);
	}
}
