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
//   - Default headless runs (CI + dev `pnpm test:e2e`) get a tight budget —
//     90s per test and 10s per `expect` assertion. Obsidian boot (~3-5s) plus
//     a handful of UI clicks fits well under that. Anything slower is a real
//     bug worth catching, not a time-budget problem.
const DEMO_ON = !!process.env.PW_DEMO && process.env.PW_DEMO !== "0" && process.env.PW_DEMO !== "false";
// --ui and --debug put a human at the keyboard; disable timeouts in both.
// PWDEBUG is the official env var Playwright sets for the Inspector; argv
// catches `--ui` and `--debug` passed directly to `playwright test`.
const DEBUG_ON = !!process.env.PWDEBUG || process.argv.includes("--ui") || process.argv.includes("--debug");

const TEST_TIMEOUT = DEBUG_ON ? 0 : DEMO_ON ? 1_800_000 : 90_000;
const EXPECT_TIMEOUT = DEBUG_ON ? 0 : DEMO_ON ? 120_000 : 10_000;
// `actionTimeout` caps every `waitFor` / `click` / `fill` that doesn't pass its
// own `timeout`. Mirrors EXPECT_TIMEOUT so specs can omit per-call timeouts
// entirely — see feedback_e2e_no_timeout_overrides. Without this, actions fall
// back to testTimeout (90s) and a single hung wait eats the whole spec.
const ACTION_TIMEOUT = DEBUG_ON ? 0 : DEMO_ON ? 120_000 : 10_000;

export default defineConfig({
	outputDir: "./test-results",
	fullyParallel: false,
	workers: 1,
	timeout: TEST_TIMEOUT,
	expect: { timeout: EXPECT_TIMEOUT },
	forbidOnly: !!process.env.CI,
	retries: 0,
	// `line` keeps output to one line per test (not per attempt) so the summary
	// is readable even when several specs run. Full detail still lands in the
	// HTML report + `.cache/last-run.log`.
	reporter: [["line"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
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
	],
});
