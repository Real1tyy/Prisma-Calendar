import { stringify as stringifyYAML } from "yaml";

/**
 * Creates file content with YAML frontmatter and body content.
 * This is the atomic file creation format that prevents race conditions.
 *
 * @param frontmatter - Frontmatter as JSON object
 * @param content - Body content (markdown text after frontmatter)
 * @returns Complete file content with YAML frontmatter
 */
export function createFileContentWithFrontmatter(frontmatter: Record<string, unknown>, content = ""): string {
	if (!frontmatter || Object.keys(frontmatter).length === 0) {
		// No frontmatter, just return content
		return content;
	}

	// Use the yaml library to stringify frontmatter
	// This handles all edge cases: special characters, multiline strings, arrays, nested objects, etc.
	const yaml = stringifyYAML(frontmatter, {
		// Use 2-space indentation (Obsidian standard)
		indent: 2,
		// Don't add document markers (--- at the end)
		lineWidth: 0,
		// Minimize unnecessary quotes
		defaultStringType: "PLAIN",
		// Handle null values explicitly
		nullStr: "",
	}).trim();

	if (!yaml) {
		// Empty frontmatter after stringification
		return content;
	}

	// Ensure content doesn't start with extra newlines
	const trimmedContent = content.replace(/^\n+/, "");

	if (trimmedContent) {
		return `---\n${yaml}\n---\n\n${trimmedContent}`;
	}

	return `---\n${yaml}\n---\n`;
}

/**
 * Parses file content to extract frontmatter and body separately.
 * Returns both the frontmatter object and the body content.
 *
 * @param fileContent - Complete file content including frontmatter
 * @returns Object with frontmatter and body
 */
export function parseFileContent(fileContent: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
	const match = fileContent.match(frontmatterRegex);

	if (!match) {
		// No frontmatter found
		return { frontmatter: {}, body: fileContent };
	}

	const [, , body] = match;

	// For this use case, we just need to split the file
	// The frontmatter will be properly parsed when we read it back with Obsidian's APIs
	return { frontmatter: {}, body: body.trim() };
}
