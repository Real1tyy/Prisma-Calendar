import path from "node:path";

export interface RunStemParts {
	profile: string;
	scenario: string;
	date?: Date;
}

/** Filesystem-safe ISO timestamp (colons/dots replaced with dashes). */
export function isoStamp(date: Date = new Date()): string {
	return date.toISOString().replace(/[:.]/g, "-");
}

/** `<iso>_<profile>_<scenario>` — the per-run artifact directory name. */
export function buildRunStem({ profile, scenario, date }: RunStemParts): string {
	return `${isoStamp(date)}_${profile}_${scenario}`;
}

/** Absolute artifact directory for a run under `root`. */
export function buildArtifactDir(root: string, stem: string): string {
	return path.join(root, stem);
}

/** `<scenario>.<profile>.json` — the committed baseline filename. */
export function baselineFileName(scenario: string, profile: string): string {
	return `${scenario}.${profile}.json`;
}
