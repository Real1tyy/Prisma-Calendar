import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { sharedVitestAliases } from "./shared/src/testing/vitest-aliases.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test files/directories that need a DOM environment. Single source of truth
// used by both the jsdom project's `include` and the node project's `exclude`.
const JSDOM_PATTERNS = [
	"tests/components/**/*.test.ts",
	"tests/integrations/calendar-bundle.test.ts",
	"tests/core/minimized-modal-manager.test.ts",
	"tests/core/notification-manager.test.ts",
	"tests/utils/event-tooltip-snapshots.test.ts",
	"tests/visual/generate-fixtures.test.ts",
];

const SHARED_EXCLUDE = ["**/node_modules/**", "**/dist/**", "**/*.visual.spec.ts", "e2e/**"];

export default defineConfig({
	test: {
		globals: true,
		testTimeout: 10000,
		setupFiles: ["./tests/setup.ts"],
		// Playwright owns *.visual.spec.ts and the e2e/ suite — vitest should skip them.
		exclude: SHARED_EXCLUDE,
		pool: "threads",
		isolate: false,
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["tests/**/*.test.ts"],
					exclude: [...SHARED_EXCLUDE, ...JSDOM_PATTERNS],
				},
			},
			{
				extends: true,
				test: {
					name: "jsdom",
					environment: "jsdom",
					include: JSDOM_PATTERNS,
				},
			},
		],
	},
	resolve: {
		alias: [
			{ find: "obsidian", replacement: path.resolve(__dirname, "tests/mocks/obsidian.ts") },
			...sharedVitestAliases(__dirname),
		],
		extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
	},
	// Ensure external dependencies can find obsidian
	define: {
		global: "globalThis",
	},
});
