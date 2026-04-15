import { defineConfig } from "@playwright/test";

// Two-project split, matching the incremental-reading-obsidian pattern:
//   - "bootstrap" runs first, a single test that proves Obsidian launches
//     with prisma-calendar loaded and configured. This is the gate.
//   - "specs" is the actual suite. It depends on "bootstrap" — Playwright
//     will not run specs unless bootstrap passes first.

export default defineConfig({
	outputDir: "./test-results",
	fullyParallel: false,
	workers: 1,
	timeout: 500_000,
	expect: { timeout: 30_000 },
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
