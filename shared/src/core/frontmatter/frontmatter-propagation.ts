import { TFile, type App } from "obsidian";

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

		// Obsidian types the frontmatter callback parameter as `any`; narrowing it
		// here keeps every property access below type-checked.
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			for (const change of diff.added) {
				fm[change.key] = sourceFrontmatter[change.key];
			}

			for (const change of diff.modified) {
				fm[change.key] = sourceFrontmatter[change.key];
			}

			for (const change of diff.deleted) {
				Reflect.deleteProperty(fm, change.key);
			}
		});
	} catch (error) {
		console.error(`Error applying frontmatter changes to ${targetPath}:`, error);
	}
}
