/**
 * Reusable security guards for untrusted, network-derived values.
 */

function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

/**
 * Returns true only if `segment` is a single, safe path component — safe to interpolate into a
 * vault/config path without enabling directory traversal or hidden-path tricks.
 *
 * Rejects: empty strings, `.`/`..`, any value containing a path separator (`/` or `\`), a `..`
 * sequence, a control character, or a leading dot. Use this before building a filesystem path
 * from a network-controlled identifier (e.g. a plugin id read from a downloaded manifest).
 */
export function isSafePathSegment(segment: string): boolean {
	if (!segment || segment.length > 255) return false;
	if (segment === "." || segment === "..") return false;
	if (segment.startsWith(".")) return false;
	if (segment.includes("/") || segment.includes("\\")) return false;
	if (segment.includes("..")) return false;
	if (hasControlChar(segment)) return false;
	return true;
}

/**
 * Returns true only if `rawUrl` is an `https:` URL whose host is in `allowedHosts`. Entries may be
 * exact (`github.com`) or a wildcard suffix (`*.githubusercontent.com`, matching the apex and any
 * subdomain). Returns false for unparseable URLs, non-https schemes, or disallowed hosts.
 *
 * Use this before fetching a URL taken from an untrusted source to prevent SSRF / fetch redirection
 * to attacker-controlled or internal hosts.
 */
export function isUrlWithAllowedHost(rawUrl: string, allowedHosts: string[]): boolean {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}
	if (url.protocol !== "https:") return false;

	const host = url.hostname.toLowerCase();
	return allowedHosts.some((allowed) => {
		const entry = allowed.toLowerCase();
		if (entry.startsWith("*.")) {
			const suffix = entry.slice(2);
			return host === suffix || host.endsWith(`.${suffix}`);
		}
		return host === entry;
	});
}
