import { defineConfig } from "@playwright/test";

// Two-project split, matching the incremental-reading-obsidian pattern:
//   - "bootstrap" runs first, a single test that proves Obsidian launches
//     with prisma-calendar loaded and configured. This is the gate.
//   - "specs" is the actual suite. It depends on "bootstrap" — Playwright
//     will not run specs unless bootstrap passes first.

// Timeouts are mode-dependent:
//   - Debug modes (PWDEBUG=1 / --ui via E2E_UI_MODE) disable all timeouts so a
//     human-at-the-keyboard can pause without getting cut off.
//   - Demo mode (PW_DEMO=1) slows every action and holds the window open after
//     each spec. A 15-field fill at 250ms slowMo + matching demoPause + hold
//     easily crosses the normal envelope, so triple it.
//   - Default headless runs (CI + dev `pnpm test:e2e`) get a 90s budget. Each
//     test spawns a fresh Obsidian process — bootstrap is typically 1-3s but
//     can spike to 30-35s under disk/memory pressure during long serial runs.
//     90s leaves ample room for spike + test body while still failing fast on
//     genuine hangs.
const DEMO_ON = !!process.env.PW_DEMO && process.env.PW_DEMO !== "0" && process.env.PW_DEMO !== "false";
// --ui and --debug put a human at the keyboard; disable timeouts in both.
// PWDEBUG is the official env var Playwright sets for the Inspector; argv
// catches `--ui` and `--debug` passed directly to `playwright test`.
const DEBUG_ON = !!process.env.PWDEBUG || process.argv.includes("--ui") || process.argv.includes("--debug");
// PRISMA_PREVIEW=1 turns on the onboarding-walkthrough preview project: it records
// video + per-step screenshots of the full tour into e2e/.preview/ so humans and
// agents can review it. Off by default, the preview project is omitted entirely —
// it never runs in CI, the full suite, or test:e2e:changed (which only scans
// e2e/specs/, not e2e/preview/).
const PREVIEW_ON =
	!!process.env.PRISMA_PREVIEW && process.env.PRISMA_PREVIEW !== "0" && process.env.PRISMA_PREVIEW !== "false";

const TEST_TIMEOUT = DEBUG_ON ? 0 : DEMO_ON ? 1_800_000 : 45_000;
// 5s assertion budget. If a UI element is genuinely going to appear, it does
// so well within 5s under the test harness — the indexer is fast, debounces
// are flipped to 0 by `window.E2E` (see `debounceMsForEnv`), and there are no
// network calls. The previous 10s default just made failures take twice as
// long without catching any real-world flake.
const EXPECT_TIMEOUT = DEBUG_ON ? 0 : DEMO_ON ? 120_000 : 5_000;
// `actionTimeout` caps every `waitFor` / `click` / `fill` that doesn't pass its
// own `timeout`. Mirrors EXPECT_TIMEOUT so specs can omit per-call timeouts
// entirely — see feedback_e2e_no_timeout_overrides. Without this, actions fall
// back to testTimeout and a single hung wait eats the whole spec.
const ACTION_TIMEOUT = DEBUG_ON ? 0 : DEMO_ON ? 120_000 : 5_000;

export default defineConfig({
	outputDir: "./test-results",
	fullyParallel: !DEBUG_ON,
	workers: DEBUG_ON ? 1 : 3,
	timeout: TEST_TIMEOUT,
	expect: { timeout: EXPECT_TIMEOUT },
	forbidOnly: !!process.env.CI,
	// One retry locally / two on CI absorbs residual bootstrap timing spikes
	// that the 45s budget doesn't cover (extreme disk pressure, OOM thrashing).
	retries: process.env.CI ? 2 : 1,
	// `line` keeps output to one line per test (not per attempt) so the summary
	// is readable even when several specs run. Full detail still lands in the
	// HTML report + `.cache/last-run.log`.
	// `infra-error-reporter` collapses a "node_modules rebuilt mid-run" pile of
	// per-spec resolution failures into one ENVIRONMENT IN FLUX verdict instead
	// of dozens of look-alike test failures (see the shared module + the at-launch
	// preflight in shared/scripts/e2e/check-e2e-deps.mjs).
	reporter: [
		["line"],
		["html", { open: "never", outputFolder: "./playwright-report" }],
		["../../shared/src/testing/e2e/infra-error-reporter.ts"],
	],
	use: {
		trace: "retain-on-failure",
		screenshot: PREVIEW_ON ? "on" : "only-on-failure",
		video: PREVIEW_ON ? "on" : "retain-on-failure",
		actionTimeout: ACTION_TIMEOUT,
	},
	projects: [
		{
			name: "bootstrap",
			testDir: "./setup",
			testMatch: /bootstrap\.spec\.ts$/,
		},
		{
			name: "specs",
			testDir: "./specs",
			testMatch: /.*\.spec\.ts$/,
			dependencies: ["bootstrap"],
		},
		// Only present under PRISMA_PREVIEW=1 — keeps the walkthrough out of the
		// real suite while still sharing the bootstrap gate when explicitly run.
		...(PREVIEW_ON
			? [
					{
						name: "preview",
						testDir: "./preview",
						testMatch: /.*\.spec\.ts$/,
						dependencies: ["bootstrap"],
					},
				]
			: []),
	],
});
