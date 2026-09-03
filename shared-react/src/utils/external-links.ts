/**
 * Rewire every external `<a href="http…">` inside a container — produced by
 * Obsidian's `MarkdownRenderer.render`, which leaves plain anchors — so a click
 * opens the URL in the system browser instead of navigating the Obsidian window.
 * Tags each rewired anchor with `external-link` so the stylesheet can decorate it.
 *
 * Shared by every React surface that renders untrusted/authored markdown
 * (what's-new, help center) — the link handling is identical, so it lives here
 * rather than being reinvented per modal.
 */
export function makeExternalLinksClickable(container: HTMLElement): void {
	const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");
	for (const link of Array.from(links)) {
		const href = link.getAttribute("href");
		if (!href || !href.startsWith("http")) continue;

		link.addEventListener("click", (e: MouseEvent) => {
			e.preventDefault();
			const ownerWindow = link.ownerDocument.defaultView ?? window;
			ownerWindow.open(href, "_blank");
		});
		link.classList.add("external-link");
	}
}
