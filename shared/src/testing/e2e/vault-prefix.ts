import { basename } from "node:path";

// Shared convention for per-run vault directory naming across every plugin's
// E2E suite. The shared bootstrap composes the final vault dir as
// `YYYY-MM-DD-HHmm-<prefix>-<uuid>`; this module produces the `<prefix>` portion
// from the Playwright `testInfo.file` + `testInfo.title` so `ls e2e/.cache/vaults/`
// tells you which test produced which retained vault.

const SPEC_SUFFIX_RE = /\.(spec|test)\.(ts|tsx|js|mjs|mts|cjs)$/;

// Linux caps filenames at 255 bytes. The full vault dir is
// `YYYY-MM-DD-HHmm-<prefix>-<uuid8>` (25 fixed chars + prefix), so the prefix
// can go well past 200 chars without risk. These defaults aim for "readable at
// a glance" — long enough to not truncate real test titles, short enough to
// keep `ls` output aligned.
const DEFAULT_SPEC_MAX_LENGTH = 48;
const DEFAULT_TITLE_MAX_LENGTH = 80;

export type VaultPrefixOptions = {
	/** Max length of the spec-file slug segment. Defaults to 48. */
	specMaxLength?: number;
	/** Max length of the test-title slug segment. Defaults to 80. */
	titleMaxLength?: number;
	/** Fallback prefix when both slugs collapse to an empty string. Defaults to "spec". */
	fallback?: string;
};

/**
 * Build the `<prefix>` portion of a per-run vault directory name from a
 * Playwright `testInfo.file` + `testInfo.title`. Produces a kebab-slug of
 * `<spec-file>-<test-title>`, truncated to stay well under the 255-byte
 * filename limit once the bootstrap prepends the timestamp and appends the
 * uuid.
 */
export function buildVaultPrefix(file: string, title: string, options: VaultPrefixOptions = {}): string {
	const specMaxLength = options.specMaxLength ?? DEFAULT_SPEC_MAX_LENGTH;
	const titleMaxLength = options.titleMaxLength ?? DEFAULT_TITLE_MAX_LENGTH;
	const fallback = options.fallback ?? "spec";
	const spec = basename(file).replace(SPEC_SUFFIX_RE, "");
	const joined = [slug(spec, specMaxLength), slug(title, titleMaxLength)].filter(Boolean).join("-");
	return joined || fallback;
}

export function slug(value: string, maxLength: number): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, maxLength)
		.replace(/-+$/g, "");
}
