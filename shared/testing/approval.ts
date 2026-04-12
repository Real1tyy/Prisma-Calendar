/**
 * Approval test helpers for snapshot-based testing of DOM output.
 *
 * Use with Vitest's built-in `toMatchFileSnapshot()` to catch visual regressions
 * in component rendering (gantt views, grid layouts, calendar views, tables).
 *
 * @example
 * ```ts
 * const html = renderToApprovalString(containerEl);
 * expect(html).toMatchFileSnapshot('__snapshots__/weekly-view.approved.html');
 * ```
 */

const DATA_ID_PATTERN = /\s+data-id="[^"]*"/g;
const UUID_ID_PATTERN = /\s+id="[a-f0-9-]{36}"/g;
const INLINE_STYLE_PATTERN = /\s+style="[^"]*"/g;

const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g;
const DATA_TIMESTAMP_PATTERN = /data-timestamp="[^"]*"/g;
const UUID_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g;

const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

/**
 * Serializes an HTMLElement subtree to stable, readable HTML suitable for approval tests.
 *
 * Strips dynamic attributes (random IDs, inline styles) and normalizes non-deterministic
 * content (UUIDs, timestamps) so snapshots don't churn between runs.
 */
export function renderToApprovalString(element: HTMLElement, options?: { keepStyles?: boolean }): string {
	let html = element.outerHTML.replace(DATA_ID_PATTERN, "").replace(UUID_ID_PATTERN, "");

	if (!options?.keepStyles) {
		html = html.replace(INLINE_STYLE_PATTERN, "");
	}

	return formatHtml(normalizeApprovalOutput(html));
}

/**
 * Strips non-deterministic content from an HTML/text string.
 *
 * Removes timestamps, UUIDs, and other values that change between test runs.
 * Use this when you have raw HTML or text output that needs stabilizing.
 */
export function normalizeApprovalOutput(output: string): string {
	return output.replace(ISO_TIMESTAMP_PATTERN, "").replace(DATA_TIMESTAMP_PATTERN, "").replace(UUID_PATTERN, "[uuid]");
}

function formatHtml(html: string): string {
	let result = "";
	let indent = 0;

	for (const token of html.split(/(<[^>]+>)/)) {
		const trimmed = token.trim();
		if (!trimmed) continue;

		const isClosingTag = trimmed.startsWith("</");
		const isSelfClosingOrVoid = trimmed.endsWith("/>") || isVoidElement(trimmed);
		const isOpeningTag = trimmed.startsWith("<") && !isClosingTag && !isSelfClosingOrVoid;

		if (isClosingTag) indent = Math.max(0, indent - 1);
		result += "  ".repeat(indent) + trimmed + "\n";
		if (isOpeningTag) indent++;
	}

	return result.trimEnd() + "\n";
}

function isVoidElement(tag: string): boolean {
	const match = tag.match(/^<(\w+)/);
	return match ? VOID_ELEMENTS.has(match[1].toLowerCase()) : false;
}
