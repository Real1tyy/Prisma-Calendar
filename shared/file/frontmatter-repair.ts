import type { App } from "obsidian";
import type { z } from "zod";

import { getTFileOrThrow, withFrontmatter } from "./file-utils";

export async function correctFrontmatter(
	app: App,
	schema: z.ZodType,
	filePath: string,
	raw: Record<string, unknown>
): Promise<void> {
	try {
		const corrected = schema.parse(raw) as Record<string, unknown>;
		const file = getTFileOrThrow(app, filePath);
		await withFrontmatter(app, file, (fm) => {
			Object.assign(fm, corrected);
		});
	} catch {
		// If parse also fails (no defaults can fix it), treat as skip
	}
}

export async function deleteInvalidFile(app: App, filePath: string): Promise<void> {
	try {
		const file = getTFileOrThrow(app, filePath);
		await app.vault.trash(file, true);
	} catch {
		// File may already be gone
	}
}
