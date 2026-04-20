/**
 * Heuristic for detecting when the server has rejected our stored CalDAV
 * sync-token (RFC 6578 §3.8), so the sync service can clear the cursor and
 * fall back to a full refetch instead of surfacing the error to the user.
 *
 * Extracted into its own module for two reasons:
 *   1. The logic is a pure regex check — no Obsidian or tsdav dependencies —
 *      so it can be unit-tested without spinning up the full sync service.
 *   2. It protects the regex list from accidental broadening: every entry
 *      here must be grounded in a spec signal or an empirical trace, and the
 *      contract tests in `tests/integrations/caldav-sync-token-invalidation.test.ts`
 *      lock both the positives and the known-benign negatives.
 */

/**
 * Token-invalidation signals we treat as a reason to clear the stored cursor
 * and fall back to a full refetch. Only two signals are spec-grounded:
 *
 *   • RFC 6578 §3.8 — the server MUST return the <D:valid-sync-token/>
 *     precondition element when a sync-token is rejected. tsdav surfaces the
 *     condition name in the thrown error's message.
 *   • HTTP 410 Gone — not strictly mandated by RFC 6578, but used in practice
 *     by iCloud and generic WebDAV stacks for expired tokens.
 *
 * The HTTP-410 regex is anchored behind a "status" / "HTTP" prefix so a bare
 * "410" inside an unrelated URL, timestamp, or payload body does NOT trip the
 * fallback. Benign mismatches are fail-safe (one extra full refetch, never
 * data loss), but the previous broader catch-all could mask real server errors.
 */
export const TOKEN_INVALIDATED_PATTERNS: readonly RegExp[] = [
	/valid[-_ ]sync[-_ ]token/i,
	/(?:\bstatus(?:[_ ]?code)?|\bHTTP(?:\/\d+(?:\.\d+)?)?)[\s:=]+410\b/i,
];

export function isSyncTokenInvalidated(error: unknown): boolean {
	if (!error) return false;
	const message = error instanceof Error ? error.message : String(error);
	return TOKEN_INVALIDATED_PATTERNS.some((re) => re.test(message));
}
