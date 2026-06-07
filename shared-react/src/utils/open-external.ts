/**
 * Opens a URL in a new browser context with the reverse-tabnabbing guard
 * (`noopener,noreferrer`) always applied. The single home for
 * `window.open(url, "_blank", …)` so the security flags are never forgotten —
 * use this instead of calling `window.open` directly.
 */
export function openExternal(href: string): void {
	window.open(href, "_blank", "noopener,noreferrer");
}
