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
	reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
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
