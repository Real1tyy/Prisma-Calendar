import type { TFile } from "obsidian";

export const createFileLink = (file: TFile): string => {
	const folder = file.parent?.path && file.parent.path !== "/" ? file.parent.path : "";
	return folder ? `[[${folder}/${file.basename}|${file.basename}]]` : `[[${file.basename}]]`;
};
