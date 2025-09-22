import { type App, TFile } from "obsidian";

export const getTFileOrThrow = (app: App, path: string): TFile => {
	const f = app.vault.getAbstractFileByPath(path);
	if (!(f instanceof TFile)) throw new Error(`File not found: ${path}`);
	return f;
};

export const withFrontmatter = async (app: App, file: TFile, update: (fm: Record<string, unknown>) => void) =>
	app.fileManager.processFrontMatter(file, update);

export const backupFrontmatter = async (app: App, file: TFile) => {
	let copy: Record<string, unknown> = {};
	await withFrontmatter(app, file, (fm) => {
		copy = { ...fm };
	});
	return copy;
};

export const restoreFrontmatter = async (app: App, file: TFile, original: Record<string, unknown>) =>
	withFrontmatter(app, file, (fm) => {
		Object.keys(fm).forEach((k) => {
			delete fm[k];
		});
		Object.assign(fm, original);
	});

// Safe ISO shift (stays ISO even if undefined)
export const shiftISO = (iso: unknown, offsetMs?: number) => {
	if (!iso || typeof iso !== "string" || !offsetMs) return iso;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	d.setTime(d.getTime() + offsetMs);
	return d.toISOString();
};
