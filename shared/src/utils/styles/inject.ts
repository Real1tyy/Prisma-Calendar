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
 * Adoption is **per document**. Obsidian is multi-window — pop-out leaves, and
 * since 1.13 the settings window itself — and `adoptedStyleSheets` never cross
 * a window boundary (Obsidian only mirrors `<link>`/`<style>` nodes into
 * pop-outs). Callers rendering outside the main window must pass the mount
 * point's `ownerDocument`; each sheet is constructed with that window's own
 * `CSSStyleSheet`, since Chromium rejects adopting a sheet built by another
 * document's realm.
 *
 * Plugins can still override any of these rules from their own `styles.css` —
 * author-origin stylesheet order puts a later `<link>` above an adopted sheet
 * at equal specificity.
 */
const REGISTRIES = new Map<Document, Map<string, CSSStyleSheet>>();

function adoptedSheets(doc: Document): CSSStyleSheet[] {
	return Array.from(doc.adoptedStyleSheets);
}

/** Forget documents whose window is gone (closed pop-outs) so they can GC. */
function pruneClosedDocuments(): void {
	for (const doc of REGISTRIES.keys()) {
		if (doc !== document && doc.defaultView === null) REGISTRIES.delete(doc);
	}
}

function registryFor(doc: Document): Map<string, CSSStyleSheet> {
	let registry = REGISTRIES.get(doc);
	if (!registry) {
		registry = new Map();
		REGISTRIES.set(doc, registry);
	}
	return registry;
}

export function injectStyleSheet(id: string, css: string, targetDoc: Document = document): void {
	pruneClosedDocuments();
	const registry = registryFor(targetDoc);

	let sheet = registry.get(id);
	if (!sheet) {
		const SheetCtor = targetDoc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
		sheet = new SheetCtor();
		registry.set(id, sheet);
	}
	sheet.replaceSync(css);

	// Membership is re-checked every call: anything that reassigns the
	// document's adopted list silently evicts our sheet, and a replace-only
	// path would never bring it back.
	if (!targetDoc.adoptedStyleSheets.includes(sheet)) {
		targetDoc.adoptedStyleSheets = [...adoptedSheets(targetDoc), sheet];
	}
}

export function removeInjectedStyleSheet(id: string, targetDoc: Document = document): void {
	const registry = REGISTRIES.get(targetDoc);
	const sheet = registry?.get(id);
	if (!registry || !sheet) return;

	registry.delete(id);
	targetDoc.adoptedStyleSheets = adoptedSheets(targetDoc).filter((s) => s !== sheet);
}

/** The CSS currently adopted under `id`, or undefined if nothing is adopted. */
export function readInjectedStyleSheet(id: string, targetDoc: Document = document): string | undefined {
	const sheet = REGISTRIES.get(targetDoc)?.get(id);
	if (!sheet) return undefined;
	if (typeof sheet.replace !== "function" && "cssText" in sheet) {
		return (sheet as unknown as { cssText: string }).cssText;
	}
	return Array.from(sheet.cssRules)
		.map((rule) => rule.cssText)
		.join("\n");
}

export function clearInjectedStyles(): void {
	for (const [doc, registry] of REGISTRIES) {
		if (doc !== document && doc.defaultView === null) continue;
		const owned = new Set(registry.values());
		doc.adoptedStyleSheets = adoptedSheets(doc).filter((s) => !owned.has(s));
	}
	REGISTRIES.clear();
}
