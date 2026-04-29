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
	/** Minimum event count after refresh (defaults to 1). */
	minEvents?: number;
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

	const minEvents = spec.minEvents ?? 1;
	await waitForEventCount(page, minEvents);
}
