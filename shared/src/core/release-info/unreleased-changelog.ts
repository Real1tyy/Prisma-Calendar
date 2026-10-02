import { UNRELEASED_KEY } from "../../docs-site/changelog-sections";
import { isE2E } from "../../utils/e2e";
import { withDocsUtm } from "../../utils/string/changelog-parser";
import { defaultReleaseInfoTransport, type ReleaseInfoTransport } from "./release-video";

/**
 * The Unreleased section is read from the published changelog page at open
 * time, never from the bundled copy: the bundle freezes at build, so its
 * Unreleased section is stale from the day after a release.
 */
export type UnreleasedChangelog =
	| { readonly status: "ok"; readonly html: string }
	| { readonly status: "empty" }
	| { readonly status: "error"; readonly message: string };

export interface UnreleasedChangelogOptions {
	transport?: ReleaseInfoTransport;
}

const UNRELEASED_ID = UNRELEASED_KEY;
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const OFFLINE_MESSAGE = "Couldn't load the changelog. Check your connection and try again.";
const UNREADABLE_MESSAGE = "Couldn't read the published changelog. Open it in your browser instead.";

function isUnreleasedHeading(heading: Element): boolean {
	if (heading.id === UNRELEASED_ID) return true;
	// Docusaurus appends a zero-width hash-link to every heading, so compare the
	// visible word rather than the whole text.
	return (
		heading.textContent.replaceAll(ZERO_WIDTH_SPACE, "").replaceAll("#", "").trim().toLowerCase() === UNRELEASED_ID
	);
}

function resolveLinks(root: Element, pageUrl: string, documentationUrl: string): void {
	const docsOrigin = new URL(documentationUrl).origin;
	for (const anchor of Array.from(root.querySelectorAll("a[href]"))) {
		const href = anchor.getAttribute("href") ?? "";
		let resolved: URL;
		try {
			resolved = new URL(href, pageUrl);
		} catch {
			anchor.removeAttribute("href");
			continue;
		}
		const final = resolved.origin === docsOrigin ? withDocsUtm(resolved, documentationUrl) : resolved;
		anchor.setAttribute("href", final.toString());
	}
}

/**
 * Pull the `## Unreleased` block out of the rendered changelog page: the
 * heading's following siblings up to the next `h2`. Returns `null` when the
 * page isn't a changelog at all (no `h2`), and `""` when nothing is pending.
 * Links are made absolute, and docs-site links carry our UTM.
 */
export function extractUnreleasedHtml(pageHtml: string, pageUrl: string, documentationUrl: string): string | null {
	const doc = new DOMParser().parseFromString(pageHtml, "text/html");
	const headings = Array.from(doc.querySelectorAll("h2"));
	if (headings.length === 0) return null;
	// A release retitles `## Unreleased` as the version, so a changelog page
	// without one simply has nothing pending.
	const heading = headings.find(isUnreleasedHeading);
	if (heading === undefined) return "";

	const container = doc.createElement("div");
	for (let node = heading.nextElementSibling; node !== null; node = node.nextElementSibling) {
		if (node.tagName === "H2" || node.tagName === "H1") break;
		container.appendChild(node.cloneNode(true));
	}
	for (const hashLink of Array.from(container.querySelectorAll("a.hash-link"))) hashLink.remove();
	while (container.lastElementChild?.tagName === "HR") container.lastElementChild.remove();

	resolveLinks(container, pageUrl, documentationUrl);
	return container.textContent.trim() ? container.innerHTML : "";
}

/**
 * Where to read the published changelog. The E2E override points every
 * plugin at a loopback page, for the same reason as the API base URL: the
 * request leaves through Electron's main process, out of Playwright's reach.
 */
export function resolveChangelogPageUrl(pageUrl: string): string {
	if (isE2E()) {
		const override: unknown = (window as unknown as { __changelogPageUrl?: unknown }).__changelogPageUrl;
		if (typeof override === "string" && override) return override;
	}
	return pageUrl;
}

export async function fetchUnreleasedChangelog(
	pageUrl: string,
	documentationUrl: string,
	options: UnreleasedChangelogOptions = {}
): Promise<UnreleasedChangelog> {
	const transport = options.transport ?? defaultReleaseInfoTransport;
	const url = resolveChangelogPageUrl(pageUrl);
	try {
		const response = await transport(url);
		if (response.status < 200 || response.status >= 300 || response.body === undefined) {
			return { status: "error", message: OFFLINE_MESSAGE };
		}
		const html = extractUnreleasedHtml(response.body, url, documentationUrl);
		if (html === null) return { status: "error", message: UNREADABLE_MESSAGE };
		return html === "" ? { status: "empty" } : { status: "ok", html };
	} catch {
		return { status: "error", message: OFFLINE_MESSAGE };
	}
}
