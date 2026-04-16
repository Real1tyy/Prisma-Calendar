import { defineConfig } from "@playwright/test";

// Two-project split, matching the incremental-reading-obsidian pattern:
//   - "bootstrap" runs first, a single test that proves Obsidian launches
//     with prisma-calendar loaded and configured. This is the gate.
//   - "specs" is the actual suite. It depends on "bootstrap" — Playwright
//     will not run specs unless bootstrap passes first.

// Demo mode (PW_DEMO=1) slows every action + adds a post-test hold. Standard
// timeouts don't fit: a spec that normally fills 15 fields at ~50ms each now
// paces every step at the slowMo value plus a matching `demoPause`, and the
// hold itself is counted against the test timeout. Triple the envelope so
// demo runs don't fail on pacing alone.
const DEMO_ON = !!process.env.PW_DEMO && process.env.PW_DEMO !== "0" && process.env.PW_DEMO !== "false";

export default defineConfig({
	outputDir: "./test-results",
	fullyParallel: false,
	workers: 1,
	timeout: DEMO_ON ? 1_800_000 : 500_000,
	expect: { timeout: DEMO_ON ? 120_000 : 30_000 },
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
