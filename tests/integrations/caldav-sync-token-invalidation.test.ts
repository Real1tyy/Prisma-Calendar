/**
 * Contract tests for `isSyncTokenInvalidated` — the heuristic that decides
 * whether a thrown error from `tsdav.smartCollectionSync` should trigger a
 * full-refetch recovery or bubble up as a normal sync failure.
 *
 * Two classes of assertion:
 *   1. Real RFC 6578 / HTTP 410 signals we DO want to catch (positives).
 *   2. Benign messages that previously tripped the broader regex and could
 *      have masked real server errors by triggering an unnecessary full
 *      refetch (negatives). These are the regressions we're locking against.
 */
import { describe, expect, it } from "vitest";

import { isSyncTokenInvalidated } from "../../src/core/integrations/caldav/sync-token-invalidation";

describe("isSyncTokenInvalidated — positive signals we must catch", () => {
	it("catches the RFC 6578 §3.8 precondition element verbatim", () => {
		expect(isSyncTokenInvalidated(new Error("precondition failed: valid-sync-token"))).toBe(true);
	});

	it("catches the precondition element regardless of separator styling", () => {
		expect(isSyncTokenInvalidated(new Error("valid_sync_token"))).toBe(true);
		expect(isSyncTokenInvalidated(new Error("valid sync token"))).toBe(true);
		expect(isSyncTokenInvalidated(new Error("VALID-SYNC-TOKEN precondition"))).toBe(true);
	});

	it("catches HTTP 410 errors shaped as a status line", () => {
		expect(isSyncTokenInvalidated(new Error("HTTP 410 Gone"))).toBe(true);
		expect(isSyncTokenInvalidated(new Error("HTTP/1.1 410 Gone"))).toBe(true);
	});

	it("catches HTTP 410 errors shaped as a status-code field", () => {
		expect(isSyncTokenInvalidated(new Error("Request failed with status 410"))).toBe(true);
		expect(isSyncTokenInvalidated(new Error("statusCode: 410"))).toBe(true);
		expect(isSyncTokenInvalidated(new Error("status_code=410"))).toBe(true);
	});
});

describe("isSyncTokenInvalidated — benign messages we must NOT trip on", () => {
	it("does not false-positive on a bare 'gone' in an unrelated error", () => {
		expect(isSyncTokenInvalidated(new Error("the file is gone from disk"))).toBe(false);
	});

	it("does not false-positive on a bare 410 embedded in a URL or timestamp", () => {
		expect(isSyncTokenInvalidated(new Error("fetch https://cdn.example.com/api/v410/x failed"))).toBe(false);
		expect(isSyncTokenInvalidated(new Error("timestamp 1692345610 exceeded retention"))).toBe(false);
	});

	it("does not false-positive on generic 'sync token' mentions without the precondition element", () => {
		// Catches the old over-broad /sync[-_ ]?token/i regex — these were false
		// positives that could mask config errors by triggering a fallback.
		expect(isSyncTokenInvalidated(new Error("sync token is required for this operation"))).toBe(false);
		expect(isSyncTokenInvalidated(new Error("sync-token missing from request"))).toBe(false);
		expect(isSyncTokenInvalidated(new Error("invalid synctoken header value"))).toBe(false);
	});

	it("does not false-positive on non-410 HTTP status errors", () => {
		expect(isSyncTokenInvalidated(new Error("HTTP 500 Internal Server Error"))).toBe(false);
		expect(isSyncTokenInvalidated(new Error("status 401 unauthorized"))).toBe(false);
		expect(isSyncTokenInvalidated(new Error("Request failed with status 403"))).toBe(false);
	});

	it("returns false for null / undefined / non-Error shapes", () => {
		expect(isSyncTokenInvalidated(null)).toBe(false);
		expect(isSyncTokenInvalidated(undefined)).toBe(false);
		expect(isSyncTokenInvalidated("")).toBe(false);
	});

	it("coerces non-Error throwns to string and matches only on real signals", () => {
		expect(isSyncTokenInvalidated("HTTP 410")).toBe(true);
		expect(isSyncTokenInvalidated("sync token missing")).toBe(false);
	});
});
