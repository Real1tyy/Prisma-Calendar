import type { App } from "obsidian";

import { getTFileOrThrow, withFrontmatter } from "../file/file-utils";
import type { SerializableSchema } from "../vault-table/create-mapped-schema";
import { enforcePropertyOrder } from "./property-order";

export async function correctFrontmatter<TData>(
	app: App,
	schema: SerializableSchema<TData>,
	filePath: string,
	raw: Record<string, unknown>,
	propertyOrder?: readonly string[]
): Promise<void> {
	try {
		const corrected = schema.parse(raw);
		const serialized = schema.serialize(corrected);
		const file = getTFileOrThrow(app, filePath);
		await withFrontmatter(app, file, (fm) => {
			Object.assign(fm, serialized);
			if (propertyOrder && propertyOrder.length > 0) enforcePropertyOrder(fm, propertyOrder);
		});
	} catch {
		// If parse also fails (no defaults can fix it), treat as skip
	}
}

export async function deleteInvalidFile(app: App, filePath: string): Promise<void> {
	try {
		const file = getTFileOrThrow(app, filePath);
		await app.fileManager.trashFile(file);
	} catch {
		// File may already be gone
	}
}
