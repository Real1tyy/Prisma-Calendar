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

export function formatChangelogSections(sections: VersionSection[]): string {
	if (sections.length === 0) {
		return "No changes found.";
	}

	return sections
		.map((section) => {
			// Escape Dataview inline queries to prevent parsing errors
			const content = section.content.replace(/`=([^`]+)`/g, "`\\=$1`");
			return `## ${section.version}\n\n${content}`;
		})
		.join("\n\n");
}

export type { VersionSection };
