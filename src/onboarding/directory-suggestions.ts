import { getTopLevelDirectory, isDateLikeString } from "@real1ty-obsidian-plugins";
import type { App, TFile } from "obsidian";

export interface DirectorySuggestion {
	directory: string;
	fileCount: number;
	matchedProps: string[];
}

interface FileFrontmatterLike {
	path: string;
	frontmatter: Record<string, unknown> | null | undefined;
}

export function isDateLikeFrontmatterValue(value: unknown): boolean {
	return typeof value === "string" && isDateLikeString(value);
}

function summarizeFile(frontmatter: Record<string, unknown>): { matchedProps: string[] } | null {
	const matchedProps = Object.entries(frontmatter)
		.filter(([, value]) => isDateLikeFrontmatterValue(value))
		.map(([key]) => key);

	if (matchedProps.length === 0) return null;

	return {
		matchedProps,
	};
}

export function buildDirectorySuggestions(files: FileFrontmatterLike[]): DirectorySuggestion[] {
	const buckets = new Map<
		string,
		{
			fileCount: number;
			propCounts: Map<string, number>;
		}
	>();

	for (const file of files) {
		if (!file.frontmatter) continue;
		const directory = getTopLevelDirectory(file.path);
		if (!directory) continue;

		const summary = summarizeFile(file.frontmatter);
		if (!summary) continue;

		const bucket = buckets.get(directory) ?? {
			fileCount: 0,
			propCounts: new Map<string, number>(),
		};

		bucket.fileCount += 1;

		for (const key of summary.matchedProps) {
			bucket.propCounts.set(key, (bucket.propCounts.get(key) ?? 0) + 1);
		}

		buckets.set(directory, bucket);
	}

	return Array.from(buckets.entries())
		.map(([directory, bucket]) => ({
			directory,
			fileCount: bucket.fileCount,
			matchedProps: Array.from(bucket.propCounts.entries())
				.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
				.map(([key]) => key)
				.slice(0, 4),
		}))
		.filter((entry) => entry.fileCount > 0)
		.sort((a, b) => b.fileCount - a.fileCount || a.directory.localeCompare(b.directory))
		.slice(0, 6);
}

export async function scanVaultForDirectorySuggestions(app: App): Promise<DirectorySuggestion[]> {
	const files = app.vault.getMarkdownFiles();
	const materialized = files.map((file: TFile) => ({
		path: file.path,
		frontmatter: app.metadataCache.getFileCache(file)?.frontmatter ?? null,
	}));
	return buildDirectorySuggestions(materialized);
}

export function formatDirectorySuggestionMeta(suggestion: DirectorySuggestion): string {
	const props =
		suggestion.matchedProps.length > 0
			? `Found date-like properties: ${suggestion.matchedProps.join(", ")}`
			: "Found date-like properties";
	return `${suggestion.fileCount} note${suggestion.fileCount === 1 ? "" : "s"} · ${props}`;
}

export function formatDirectorySuggestionDescription(suggestion: DirectorySuggestion): string {
	return suggestion.fileCount === 1
		? "Contains a note with date-like frontmatter properties."
		: "Contains notes with date-like frontmatter properties.";
}
