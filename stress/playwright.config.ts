import { defineConfig } from "@playwright/test";

// Stress/perf config — distinct from e2e/playwright.config.ts. Key differences:
//   - serial (workers: 1, no parallelism) so measurements never contend for CPU.
//   - no retries — a perf regression must surface, not be retried away.
//   - generous timeout — seeding a large vault + many navigations is slow.
const DEBUG_ON = !!process.env["PWDEBUG"] || process.argv.includes("--ui") || process.argv.includes("--debug");

// Heavy (large-profile) runs can exceed the default — raise via STRESS_TIMEOUT_MS.
const TEST_TIMEOUT = DEBUG_ON ? 0 : Number(process.env["STRESS_TIMEOUT_MS"]) || 300_000;
const EXPECT_TIMEOUT = DEBUG_ON ? 0 : 60_000;
const ACTION_TIMEOUT = DEBUG_ON ? 0 : 60_000;

export default defineConfig({
	outputDir: "./test-results",
	fullyParallel: false,
	workers: 1,
	timeout: TEST_TIMEOUT,
	expect: { timeout: EXPECT_TIMEOUT },
	forbidOnly: !!process.env["CI"],
	retries: 0,
	reporter: [["line"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		actionTimeout: ACTION_TIMEOUT,
	},
	projects: [
		{
			name: "stress",
			testDir: "./specs",
			testMatch: /.*\.perf\.spec\.ts$/,
		},
	],
});
