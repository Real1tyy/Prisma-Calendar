import { classifyDateLikeString, type DateLikeKind, getTopLevelDirectory } from "@real1ty-obsidian-plugins";
import type { App, TFile } from "obsidian";

export interface DirectorySuggestion {
	directory: string;
	fileCount: number;
	dateProps: string[];
	datetimeProps: string[];
}

interface FileFrontmatterLike {
	path: string;
	frontmatter: Record<string, unknown> | null | undefined;
}

function classifyFrontmatterProps(frontmatter: Record<string, unknown>) {
	return Object.entries(frontmatter).flatMap(([key, value]) => {
		if (typeof value !== "string") return [];
		const kind = classifyDateLikeString(value);
		return kind ? [{ key, kind }] : [];
	});
}

interface PropTally {
	count: number;
	datetimeCount: number;
}

const MAX_PROPS_PER_KIND = 4;
const MAX_SUGGESTIONS = 6;

function topPropsByCount(tally: Map<string, PropTally>, kind: DateLikeKind): string[] {
	return Array.from(tally.entries())
		.filter(([, t]) => (kind === "datetime" ? t.datetimeCount > 0 : t.datetimeCount === 0))
		.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
		.map(([key]) => key)
		.slice(0, MAX_PROPS_PER_KIND);
}

export function buildDirectorySuggestions(files: FileFrontmatterLike[]): DirectorySuggestion[] {
	const buckets = new Map<
		string,
		{
			fileCount: number;
			propCounts: Map<string, PropTally>;
		}
	>();

	for (const file of files) {
		if (!file.frontmatter) continue;
		const directory = getTopLevelDirectory(file.path);
		if (!directory) continue;

		const classified = classifyFrontmatterProps(file.frontmatter);
		if (classified.length === 0) continue;

		const bucket = buckets.get(directory) ?? {
			fileCount: 0,
			propCounts: new Map<string, PropTally>(),
		};

		bucket.fileCount += 1;

		for (const { key, kind } of classified) {
			const existing = bucket.propCounts.get(key) ?? { count: 0, datetimeCount: 0 };
			existing.count += 1;
			if (kind === "datetime") existing.datetimeCount += 1;
			bucket.propCounts.set(key, existing);
		}

		buckets.set(directory, bucket);
	}

	return Array.from(buckets.entries())
		.map(([directory, bucket]) => ({
			directory,
			fileCount: bucket.fileCount,
			dateProps: topPropsByCount(bucket.propCounts, "date"),
			datetimeProps: topPropsByCount(bucket.propCounts, "datetime"),
		}))
		.filter((entry) => entry.fileCount > 0)
		.sort((a, b) => b.fileCount - a.fileCount || a.directory.localeCompare(b.directory))
		.slice(0, MAX_SUGGESTIONS);
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
	const parts: string[] = [];
	if (suggestion.datetimeProps.length > 0) parts.push(`datetime: ${suggestion.datetimeProps.join(", ")}`);
	if (suggestion.dateProps.length > 0) parts.push(`date: ${suggestion.dateProps.join(", ")}`);
	const props = parts.length > 0 ? `Found properties — ${parts.join(" · ")}` : "Found date-like properties";
	return `${suggestion.fileCount} note${suggestion.fileCount === 1 ? "" : "s"} · ${props}`;
}

export function formatDirectorySuggestionDescription(suggestion: DirectorySuggestion): string {
	return suggestion.fileCount === 1
		? "Contains a note with date-like frontmatter properties."
		: "Contains notes with date-like frontmatter properties.";
}
