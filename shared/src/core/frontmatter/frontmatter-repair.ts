import type { App, TFile } from "obsidian";

import { getTFileOrThrow } from "../file/file-utils";
import type { SerializableSchema } from "../vault-table/create-mapped-schema";
import { enforcePropertyOrder } from "./property-order";

/** The frontmatter writer a correction goes through — the table's integrity guard, so a duplicate key cannot block it. */
export type FrontmatterWriter = (file: TFile, update: (frontmatter: Record<string, unknown>) => void) => Promise<void>;

export async function correctFrontmatter<TData>(
	app: App,
	write: FrontmatterWriter,
	schema: SerializableSchema<TData>,
	filePath: string,
	raw: Record<string, unknown>,
	propertyOrder?: readonly string[]
): Promise<void> {
	try {
		const corrected = schema.parse(raw);
		const serialized = schema.serialize(corrected);
		const file = getTFileOrThrow(app, filePath);
		await write(file, (fm) => {
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
