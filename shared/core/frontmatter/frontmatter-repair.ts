import type { App } from "obsidian";

import { getTFileOrThrow, withFrontmatter } from "../file/file-utils";
import type { SerializableSchema } from "../vault-table/create-mapped-schema";

export async function correctFrontmatter<TData>(
	app: App,
	schema: SerializableSchema<TData>,
	filePath: string,
	raw: Record<string, unknown>
): Promise<void> {
	try {
		const corrected = schema.parse(raw);
		const serialized = schema.serialize(corrected);
		const file = getTFileOrThrow(app, filePath);
		await withFrontmatter(app, file, (fm) => {
			Object.assign(fm, serialized);
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
