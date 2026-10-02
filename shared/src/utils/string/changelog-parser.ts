interface VersionSection {
	version: string;
	content: string;
}

/**
 * Parses changelog markdown content into version sections.
 * Each section starts with "## X.Y.Z" heading.
 */
export function parseChangelog(changelogContent: string): VersionSection[] {
	const sections: VersionSection[] = [];
	const lines = changelogContent.split("\n");

	let currentVersion: string | null = null;
	let currentContent: string[] = [];

	for (const line of lines) {
		const versionMatch = line.match(/^##\s+(\d+\.\d+\.\d+)/);

		if (versionMatch) {
			if (currentVersion !== null) {
				sections.push({
					version: currentVersion,
					content: currentContent.join("\n").trim(),
				});
			}

			currentVersion = versionMatch[1];
			currentContent = [];
		} else if (currentVersion !== null) {
			currentContent.push(line);
		}
	}

	if (currentVersion !== null && currentContent.length > 0) {
		sections.push({
			version: currentVersion,
			content: currentContent.join("\n").trim(),
		});
	}

	return sections;
}

/**
 * Compares two semantic version strings.
 * Returns:
 * - negative if v1 < v2
 * - 0 if v1 === v2
 * - positive if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split(".").map(Number);
	const parts2 = v2.split(".").map(Number);

	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const num1 = parts1[i] || 0;
		const num2 = parts2[i] || 0;

		if (num1 !== num2) {
			return num1 - num2;
		}
	}

	return 0;
}

/**
 * Gets all changelog sections between fromVersion (exclusive) and toVersion (inclusive).
 * Sections are returned in reverse chronological order (newest first).
 */
export function getChangelogSince(changelogContent: string, fromVersion: string, toVersion: string): VersionSection[] {
	const allSections = parseChangelog(changelogContent);

	return allSections.filter((section) => {
		const isAfterFrom = compareVersions(section.version, fromVersion) > 0;
		const isBeforeOrEqualTo = compareVersions(section.version, toVersion) <= 0;
		return isAfterFrom && isBeforeOrEqualTo;
	});
}

const ADMONITION_TYPE_MAP: Record<string, string> = {
	note: "info",
	tip: "tip",
	info: "info",
	caution: "warning",
	danger: "danger",
	warning: "warning",
};

export function convertDocusaurusAdmonitions(content: string): string {
	return content.replace(
		/^:::(note|tip|info|caution|danger|warning)(.*)\n([\s\S]*?)^:::$/gm,
		(_match, type: string, title: string, body: string) => {
			const calloutType = ADMONITION_TYPE_MAP[type] ?? "info";
			const heading = title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
			const quotedBody = body
				.trimEnd()
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n");
			return `> [!${calloutType}] ${heading}\n${quotedBody}`;
		}
	);
}

/** One version's content as Obsidian-renderable markdown, without its version heading. */
export function formatChangelogBody(section: VersionSection): string {
	return convertDocusaurusAdmonitions(section.content)
		.replace(/`=([^`]+)`/g, "`\\=$1`")
		.replace(/^---$/gm, "")
		.trim();
}

/**
 * Stamp a docs-site URL with the documentation link's UTM attribution, tagging
 * `utm_content` with the target page so each changelog link is told apart.
 */
export function withDocsUtm(target: URL, documentationBaseUrl: string): URL {
	const resolved = new URL(target.toString());
	for (const [key, value] of new URL(documentationBaseUrl).searchParams) {
		if (key.startsWith("utm_")) resolved.searchParams.set(key, value);
	}
	const lastSegment = resolved.pathname.split("/").filter(Boolean).pop() ?? "changelog_link";
	resolved.searchParams.set("utm_content", lastSegment.replace(/-/g, "_"));
	return resolved;
}

export function resolveRelativeDocLinks(markdown: string, documentationBaseUrl: string): string {
	const baseUrl = new URL(documentationBaseUrl);
	const cleanBase = `${baseUrl.origin}${baseUrl.pathname}`.replace(/\/$/, "");

	return markdown.replace(/(?<!!)\[([^\]]+)\]\((\.[^)]+)\)/g, (_match, text: string, rawPath: string) => {
		const cleaned = rawPath.replace(/^\.\//, "").replace(/\.md(?=#|$)/, "");
		const path = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
		const hashIndex = path.indexOf("#");
		const pathPart = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
		const fragment = hashIndex >= 0 ? path.slice(hashIndex + 1) : undefined;
		const resolved = withDocsUtm(new URL(`${cleanBase}${pathPart}`), documentationBaseUrl);
		if (fragment) resolved.hash = fragment;
		return `[${text}](${resolved.toString()})`;
	});
}

/** `fromVersion` the settings "View changelog" button passes to show every release. */
export const FULL_CHANGELOG_FROM_VERSION = "0.0.0";

/**
 * Where the one-version-at-a-time view opens, given newest-first sections: the
 * full changelog starts at the newest release; an update starts at the oldest
 * version the user hasn't seen, so they read forward in the order it shipped.
 */
export function initialVersionIndex(sectionCount: number, fromVersion: string): number {
	if (sectionCount === 0) return 0;
	return fromVersion === FULL_CHANGELOG_FROM_VERSION ? 0 : sectionCount - 1;
}

/** Versions whose number contains the typed query; a leading `v` is ignored. */
export function filterVersions(sections: readonly VersionSection[], query: string): VersionSection[] {
	const needle = query.trim().replace(/^v/i, "");
	if (needle === "") return [...sections];
	return sections.filter((section) => section.version.includes(needle));
}

export type { VersionSection };
