/**
 * Runtime stylesheet registry for shared components.
 *
 * Shared components generate their CSS from the consuming plugin's `cssPrefix`,
 * so the rules are not known until runtime and cannot live in a static
 * `styles.css`. They are adopted as constructable stylesheets rather than
 * injected as `<style>` elements: Obsidian forbids attaching `style`/`link`
 * nodes (obsidianmd/no-forbidden-elements), and an adopted sheet is also
 * cheaper to replace and can be detached again without leaving DOM behind.
 *
 * Plugins can still override any of these rules from their own `styles.css` —
 * author-origin stylesheet order puts a later `<link>` above an adopted sheet
 * at equal specificity.
 */
const ADOPTED = new Map<string, CSSStyleSheet>();

function adoptedSheets(): CSSStyleSheet[] {
	return Array.from(document.adoptedStyleSheets);
}

export function injectStyleSheet(id: string, css: string): void {
	const existing = ADOPTED.get(id);
	if (existing) {
		existing.replaceSync(css);
		return;
	}

	const sheet = new CSSStyleSheet();
	sheet.replaceSync(css);
	ADOPTED.set(id, sheet);
	document.adoptedStyleSheets = [...adoptedSheets(), sheet];
}

export function removeInjectedStyleSheet(id: string): void {
	const sheet = ADOPTED.get(id);
	if (!sheet) return;

	ADOPTED.delete(id);
	document.adoptedStyleSheets = adoptedSheets().filter((s) => s !== sheet);
}

/** The CSS currently adopted under `id`, or undefined if nothing is adopted. */
export function readInjectedStyleSheet(id: string): string | undefined {
	const sheet = ADOPTED.get(id);
	if (!sheet) return undefined;
	if (typeof sheet.replace !== "function" && "cssText" in sheet) {
		return (sheet as unknown as { cssText: string }).cssText;
	}
	return Array.from(sheet.cssRules)
		.map((rule) => rule.cssText)
		.join("\n");
}

export function clearInjectedStyles(): void {
	const owned = new Set(ADOPTED.values());
	ADOPTED.clear();
	document.adoptedStyleSheets = adoptedSheets().filter((s) => !owned.has(s));
}
