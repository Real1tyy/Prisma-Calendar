import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { sharedVitestAliases, VITEST_POOL_OPTIONS } from "./shared/src/testing/vitest-aliases.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test files/directories that need a DOM environment. Single source of truth
// used by both the dom project's `include` and the node project's `exclude`.
const DOM_PATTERNS = [
	"tests/components/**/*.test.ts",
	"tests/components/**/*.test.tsx",
	"tests/integrations/calendar-bundle.test.ts",
	"tests/core/minimized-modal-manager.test.ts",
	"tests/core/notification-manager.test.ts",
	"tests/utils/event-tooltip-snapshots.test.ts",
	"tests/visual/generate-fixtures.test.ts",
];

// A small set of specs are pinned to jsdom because their assertions depend on
// jsdom-specific behavior that happy-dom doesn't match:
//   - heatmap-renderer relies on jsdom's SVG/innerHTML serialization
//   - zoom-control exercises Ctrl+wheel handling and happy-dom's WheelEvent
//     differs in `preventDefault`/`ctrlKey` propagation through React handlers
const JSDOM_PATTERNS = ["tests/components/heatmap-renderer.test.ts", "tests/components/views/zoom-control.test.tsx"];

const SHARED_EXCLUDE = ["**/node_modules/**", "**/dist/**", "**/*.visual.spec.ts", "e2e/**", "stress/**"];

export default defineConfig({
	test: {
		globals: true,
		testTimeout: 10000,
		// vitest 4 narrowed `vi.restoreAllMocks()` and no longer clears `vi.fn`/spy
		// call history between tests the way v3 effectively did. Clear mock state
		// before each test so specs asserting call counts (e.g. spyOn singletons)
		// see only their own invocations.
		clearMocks: true,
		setupFiles: ["./tests/setup.ts"],
		// Playwright owns *.visual.spec.ts and the e2e/ suite — vitest should skip them.
		exclude: SHARED_EXCLUDE,
		...VITEST_POOL_OPTIONS,
		pool: "threads",
		// Isolate per file: vitest 4 caches mocked modules across files when
		// `isolate: false`, so per-file `vi.mock(…)` clobbers the shared module
		// for other specs in the worker (order-dependent flakes).
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["tests/**/*.test.ts"],
					exclude: [...SHARED_EXCLUDE, ...DOM_PATTERNS],
					isolate: true,
				},
			},
			{
				extends: true,
				test: {
					name: "dom",
					environment: "happy-dom",
					include: DOM_PATTERNS,
					exclude: [...SHARED_EXCLUDE, ...JSDOM_PATTERNS],
					isolate: true,
				},
			},
			{
				extends: true,
				test: {
					name: "jsdom",
					environment: "jsdom",
					include: JSDOM_PATTERNS,
					isolate: true,
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
