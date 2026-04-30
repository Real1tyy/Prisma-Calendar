const INJECTED = new Set<string>();

/**
 * Injects a stylesheet into document.head. Idempotent — skips if already injected for the given ID.
 * Used by shared components to self-inject their base CSS at runtime using the cssPrefix system.
 * Plugins can override any injected style via their own styles.css (same specificity, later load order wins).
 */
export function clearInjectedStyles(): void {
	INJECTED.clear();
}

export function injectStyleSheet(id: string, css: string): void {
	if (INJECTED.has(id)) return;
	const existing = document.getElementById(id);
	if (existing) {
		existing.textContent = css;
		INJECTED.add(id);
		return;
	}

	// eslint-disable-next-line obsidianmd/no-forbidden-elements -- runtime style injection for React components
	const el = document.createElement("style");
	el.id = id;
	el.textContent = css;
	document.head.appendChild(el);
	INJECTED.add(id);
}
