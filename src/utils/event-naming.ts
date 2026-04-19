import { generateZettelId, isFolderNote, withFrontmatter } from "@real1ty-obsidian-plugins";
import type { App, TFile } from "obsidian";

import { extractZettelId, hasTimestamp, removeZettelId } from "./events/zettel-id";

/**
 * Generates a unique ZettelID by checking if the resulting path already exists.
 * If it does, increments the ID until an unused one is found.
 */
export const generateUniqueZettelId = (app: App, basePath: string, baseNameWithoutZettel: string): string => {
	let zettelIdStr = String(generateZettelId());
	let attempts = 0;
	const maxAttempts = 1000;

	while (attempts < maxAttempts) {
		const testPath = `${basePath}${baseNameWithoutZettel}-${zettelIdStr}.md`;
		const existing = app.vault.getAbstractFileByPath(testPath);

		if (!existing) {
			return zettelIdStr;
		}

		const numericId = Number.parseInt(zettelIdStr, 10);
		const incrementedId = numericId + 1;
		zettelIdStr = incrementedId.toString().padStart(14, "0");
		attempts++;
	}

	return `${String(generateZettelId())}${Math.floor(Math.random() * 1000)}`;
};

/**
 * Generates a unique file path with ZettelID for event files.
 * If the basename already contains a Prisma ZettelID, uses it as-is without adding a new one.
 * Returns both the filename and full path with a guaranteed unique ZettelID.
 */
export const generateUniqueEventPath = (
	app: App,
	directory: string,
	baseName: string
): { filename: string; fullPath: string; zettelId: string } => {
	const basePath = directory ? `${directory.replace(/\/+$/, "")}/` : "";

	if (hasTimestamp(baseName)) {
		const existingZettelId = extractZettelId(baseName);
		if (!existingZettelId) {
			throw new Error(
				"Prisma ZettelID not found in basename, but hasTimestamp returned true, this should never happen. Please create an issue."
			);
		}
		const fullPath = `${basePath}${baseName}.md`;
		if (!app.vault.getAbstractFileByPath(fullPath)) {
			return { filename: baseName, fullPath, zettelId: existingZettelId };
		}
		const strippedName = removeZettelId(baseName);
		const zettelId = generateUniqueZettelId(app, basePath, strippedName);
		const filename = `${strippedName}-${zettelId}`;
		return { filename, fullPath: `${basePath}${filename}.md`, zettelId };
	}

	const zettelId = generateUniqueZettelId(app, basePath, baseName);
	const filename = `${baseName}-${zettelId}`;
	const fullPath = `${basePath}${filename}.md`;

	return { filename, fullPath, zettelId };
};

/**
 * Ensures a file has a ZettelID embedded in both its filename and frontmatter.
 * If the file already has a ZettelID, returns it. If not, generates one and embeds it.
 * Returns the ZettelID and the potentially updated file path.
 */
export const ensureFileHasZettelId = async (
	app: App,
	file: TFile,
	zettelIdProp?: string
): Promise<{ zettelId: string; file: TFile }> => {
	const existingZettelId = extractZettelId(file.basename);

	if (existingZettelId) {
		if (zettelIdProp) {
			await withFrontmatter(app, file, (fm) => {
				if (!fm[zettelIdProp]) {
					fm[zettelIdProp] = existingZettelId;
				}
			});
		}
		return { zettelId: existingZettelId, file };
	}

	// Folder notes must not be renamed — it would break the folder structure
	if (isFolderNote(file.path)) return { zettelId: "", file };

	const baseNameWithoutZettel = file.basename;
	const directory = file.parent?.path || "";
	const { fullPath, zettelId } = generateUniqueEventPath(app, directory, baseNameWithoutZettel);

	await app.fileManager.renameFile(file, fullPath);

	if (zettelIdProp) {
		await withFrontmatter(app, file, (fm) => {
			fm[zettelIdProp] = zettelId;
		});
	}

	return { zettelId, file };
};
