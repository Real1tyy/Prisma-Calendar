import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/visual",
	testMatch: /.*\.visual\.spec\.ts$/,
	outputDir: "./tests/visual/test-results",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["list"]],
	expect: {
		toHaveScreenshot: {
			// Tight threshold since we control the environment fully.
			maxDiffPixelRatio: 0.01,
			animations: "disabled",
		},
	},
	use: {
		// Deterministic rendering defaults.
		viewport: { width: 800, height: 600 },
		deviceScaleFactor: 1,
		colorScheme: "light",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 800, height: 600 },
				deviceScaleFactor: 1,
			},
		},
	],
});
