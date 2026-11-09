import { parse as parseYAML, stringify as stringifyYAML } from "yaml";

const LEADING_FENCE = /^(```|~~~)/;

/**
 * Normalizes a body for the line right after a frontmatter block: leading
 * newlines go, except a single blank line before a code fence. Obsidian opens a
 * note whose fence sits directly under the frontmatter with the cursor inside
 * the block, so it shows raw source instead of the rendered block.
 */
export function bodyAfterFrontmatter(content: string): string {
	const trimmed = content.replace(/^\n+/, "");
	return LEADING_FENCE.test(trimmed) ? `\n${trimmed}` : trimmed;
}

/**
 * The YAML lines between the fences, without them. Every writer that builds a
 * frontmatter block from an object goes through here so they emit the same bytes.
 */
export function stringifyFrontmatterYaml(frontmatter: Record<string, unknown>): string {
	return stringifyYAML(frontmatter, {
		indent: 2,
		lineWidth: 0,
		defaultStringType: "PLAIN",
		nullStr: "",
	}).trim();
}

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

	const yaml = stringifyFrontmatterYaml(frontmatter);

	if (!yaml) {
		// Empty frontmatter after stringification
		return content;
	}

	const trimmedContent = bodyAfterFrontmatter(content);

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
