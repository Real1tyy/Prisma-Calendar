import { parse as parseYAML, stringify as stringifyYAML } from "yaml";

/**
 * Creates file content with YAML frontmatter and body content.
 * This is the atomic file creation format that prevents race conditions.
 *
 * @param frontmatter - Frontmatter as JSON object
 * @param content - Body content (markdown text after frontmatter)
 * @returns Complete file content with YAML frontmatter
 */
export function createFileContentWithFrontmatter(frontmatter: Record<string, unknown>, content = ""): string {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- frontmatter can be null at runtime from untyped callers
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

	const trimmedContent = content.replace(/^\n+/, "");

	if (trimmedContent) {
		return `---\n${yaml}\n---\n${trimmedContent}`;
	}

	return `---\n${yaml}\n---\n`;
}

/**
 * Splits file content into its parsed frontmatter and its body. A YAML block
 * that is not a mapping, or does not parse, yields empty frontmatter.
 */
export function parseFileContent(fileContent: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
	const match = fileContent.match(frontmatterRegex);

	if (!match) {
		return { frontmatter: {}, body: fileContent };
	}

	const [, yamlBlock, body] = match;
	return { frontmatter: parseFrontmatterBlock(yamlBlock), body: body.trim() };
}

function parseFrontmatterBlock(yamlBlock: string): Record<string, unknown> {
	try {
		const parsed: unknown = parseYAML(yamlBlock);
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}
