import { expect, type Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { refreshCalendar, seedEvent, type SeedEventInput, waitForEventCount } from "./seed-events";

// Template-pattern helper for the edge-case + integrations suites: every spec
// that verifies a single-event frontmatter round-trip does the same four
// steps (seed → refresh → assert frontmatter equals input literals → assert
// the indexer picked it up). Keeping the shape here collapses ~5 near-
// identical specs to a single factory call each.

export interface RoundTripAssertion {
	seed: SeedEventInput;
	/** Frontmatter keys to compare literal-for-literal (byte preservation). */
	expectFrontmatter: Record<string, string | boolean>;
	/** Expected event count after refresh (defaults to 1). */
	expectedEvents?: number;
}

export async function assertFrontmatterRoundTrip(
	page: Page,
	vaultDir: string,
	spec: RoundTripAssertion
): Promise<void> {
	const relative = seedEvent(vaultDir, spec.seed);
	await refreshCalendar(page);

	const fm = readEventFrontmatter(vaultDir, relative);
	for (const [key, value] of Object.entries(spec.expectFrontmatter)) {
		expect(fm[key], `frontmatter ${key} must round-trip byte-for-byte`).toBe(value);
	}

	const expectedEvents = spec.expectedEvents ?? 1;
	await waitForEventCount(page, expectedEvents);
}

/**
 * The Start/End Date pair — by far the most common subset of frontmatter the
 * recurring suite snapshots before a drag/skip/revert operation and asserts
 * unchanged after.
 */
export const EVENT_DATE_FRONTMATTER_FIELDS = ["Start Date", "End Date"] as const;

/**
 * Read the file fresh from disk and assert each of `fields` is unchanged
 * relative to the `before` snapshot. Both sides are coerced via `String(...)`
 * so YAML-typed dates (which `parseYaml` may resolve to a `Date`) compare
 * the same way they print in the file.
 *
 * Defaults to `EVENT_DATE_FRONTMATTER_FIELDS` — pass an explicit list when
 * asserting on other keys.
 */
export function expectFrontmatterFieldsUnchanged(
	vaultDir: string,
	relativePath: string,
	before: Record<string, unknown>,
	fields: readonly string[] = EVENT_DATE_FRONTMATTER_FIELDS
): void {
	const after = readEventFrontmatter(vaultDir, relativePath);
	for (const field of fields) {
		expect(String(after[field]), `${relativePath}: ${field} must not change`).toBe(String(before[field]));
	}
}
