import { removeCategoryFromProperty, renameCategoryInProperty } from "@real1ty-obsidian-plugins";

import type { Frontmatter } from "../../types";
import type { EventFileRepository } from "../event-file-repository";
import { FrontmatterUpdateCommand } from "./frontmatter-update-command";

/**
 * Undoable per-file rename of every occurrence of `oldName` to `newName` in
 * the `categoryProp` frontmatter value. The file's full frontmatter is
 * snapshotted before the rewrite so {@link FrontmatterUpdateCommand.undo}
 * restores the exact pre-rename state.
 */
export function renameCategoryCommand(
	repo: EventFileRepository,
	filePath: string,
	oldName: string,
	newName: string,
	categoryProp: string
): FrontmatterUpdateCommand {
	return new FrontmatterUpdateCommand(
		repo,
		filePath,
		(fm: Frontmatter) => {
			if (fm[categoryProp]) {
				fm[categoryProp] = renameCategoryInProperty(fm[categoryProp], oldName, newName);
			}
		},
		"rename-category"
	);
}

/**
 * Undoable per-file removal of `categoryName` from the `categoryProp`
 * frontmatter value. If the value is left empty after removal, the property
 * itself is deleted (matching the imperative `deleteCategoryFromFile`).
 */
export function deleteCategoryCommand(
	repo: EventFileRepository,
	filePath: string,
	categoryName: string,
	categoryProp: string
): FrontmatterUpdateCommand {
	return new FrontmatterUpdateCommand(
		repo,
		filePath,
		(fm: Frontmatter) => {
			if (fm[categoryProp]) {
				const updated = removeCategoryFromProperty(fm[categoryProp], categoryName);
				if (updated === undefined || (Array.isArray(updated) && updated.length === 0)) {
					delete fm[categoryProp];
				} else {
					fm[categoryProp] = updated;
				}
			}
		},
		"delete-category"
	);
}
