// Detection + messaging for "the dependency tree changed out from under a
// running E2E suite". When a concurrent `pnpm install` / worktree relink
// (apply/merge/validate-worktree, ensure-deps) rebuilds node_modules mid-run,
// in-flight Playwright workers fail to resolve their own test dependencies — a
// pile of per-spec `Cannot find package 'obsidian-launcher'` /
// `Cannot find module '.../@playwright/test/index.js'` errors that look like
// dozens of product failures but are one environmental event. These helpers let
// the reporter (mid-run) classify and announce it as infra, not test failure.
// See docs/decisions/2026-05-21-e2e-deps-in-flux-guard.md.

const DEP_RESOLUTION_PATTERNS: readonly RegExp[] = [
	// ESM bare specifier that no longer resolves (e.g. obsidian-launcher).
	/Cannot find package '[^']+' imported from/,
	// A file under node_modules vanished mid-resolve (e.g. @playwright/test/index.js).
	/Cannot find module '[^']*node_modules[^']*'/,
	// Node's canonical resolution error codes, in case the wording shifts.
	/ERR_MODULE_NOT_FOUND/,
	/ERR_PACKAGE_PATH_NOT_EXPORTED/,
];

// Cap the spec list in the summary so a 200-spec poisoning doesn't bury the
// guidance under its own output.
const MAX_LISTED_SPECS = 10;

/**
 * True when `text` looks like a module/package resolution failure — the
 * signature of node_modules being torn down and rebuilt mid-run. Deliberately
 * narrow: a genuine assertion failure or a bootstrap crash ("Obsidian process
 * exited before DevTools…") must NOT match, or we'd mislabel real reds as infra.
 */
export function isDepResolutionError(text: string | null | undefined): boolean {
	if (!text) return false;
	return DEP_RESOLUTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Build the dominant end-of-run banner. The run still fails (you cannot certify
 * a suite where specs never executed) — this just makes the failure legible:
 * "these reds are void, re-run", not "N tests are broken".
 */
export function formatDepsInFluxSummary(affectedSpecs: readonly string[]): string {
	const unique = [...new Set(affectedSpecs)];
	const rule = "═".repeat(70);
	const lines = [
		"",
		rule,
		"  E2E ENVIRONMENT IN FLUX — dependencies were rebuilt mid-run",
		rule,
		`  ${unique.length} spec(s) failed to resolve their test dependencies.`,
		"",
		"  This is NOT a test or product failure. node_modules was torn down and",
		"  rebuilt while the suite was running — almost always a concurrent",
		"  `pnpm install` / worktree op (apply/merge/validate-worktree, ensure-",
		"  deps) in another session.",
		"",
		"  Treat these reds as VOID and re-run the suite with no concurrent",
		"  dependency changes.",
		"",
		"  Affected specs:",
		...unique.slice(0, MAX_LISTED_SPECS).map((spec) => `    • ${spec}`),
	];
	if (unique.length > MAX_LISTED_SPECS) {
		lines.push(`    … and ${unique.length - MAX_LISTED_SPECS} more`);
	}
	lines.push(rule, "");
	return lines.join("\n");
}
