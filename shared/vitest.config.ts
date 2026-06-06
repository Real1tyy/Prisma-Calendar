import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { VITEST_POOL_OPTIONS } from "./src/testing/vitest-aliases.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test files/directories that need a DOM environment. Single source of truth
// used by both the jsdom project's `include` and the node project's `exclude`
// so the two stay in lockstep. Patterns target `.test.ts` explicitly because
// project-level `include` replaces vitest's default test-file pattern, so a
// bare `**` would pull in non-test helper files too.
const JSDOM_PATTERNS = [
	"tests/api-gateway/**/*.test.ts",
	"tests/component-renderer/**/*.test.ts",
	"tests/components/**/*.test.ts",
	"tests/context-menu/**/*.test.ts",
	"tests/grid-layout/**/*.test.ts",
	"tests/inputs/**/*.test.ts",
	"tests/mountable/**/*.test.ts",
	"tests/page-header/**/*.test.ts",
	"tests/schema-modal/**/*.test.ts",
	"tests/settings/**/*.test.ts",
	"tests/vault-table/**/*.test.ts",
	"tests/core/css-utils.test.ts",
	"tests/core/property-renderer.test.ts",
	"tests/core/release-check/release-check-service.test.ts",
	"tests/file/file.test.ts",
	"tests/testing/approval.test.ts",
];

export default defineConfig({
	server: { fs: { allow: [".."] } },
	test: {
		globals: true,
		testTimeout: 10000,
		// vitest 4 narrowed `vi.restoreAllMocks()` to only restore `vi.spyOn`
		// spies — it no longer clears `vi.fn`/automock call history between tests
		// (which v3 effectively did). Clear mock state before each test so specs
		// reading `mock.calls`/`mock.results` see only their own invocations.
		clearMocks: true,
		exclude: ["**/node_modules/**", "**/dist/**", "tests/react/**"],
		setupFiles: ["./src/testing/obsidian-dom-setup.ts"],
		...VITEST_POOL_OPTIONS,
		pool: "threads",
		// `isolate: false` shares one module cache across all test files in a
		// worker. Under vitest 3 the "mirror the full mock surface" convention kept
		// this safe, but vitest 4 caches mocked modules cross-file far more
		// aggressively: a per-file `vi.mock("obsidian" | "../indexer" | …)` now
		// clobbers the shared module for every other file in the worker, producing
		// order-dependent flakes (a different unrelated spec fails on each run).
		// The convention can no longer contain it, so we isolate per file — the
		// outcome the previous comment reserved for "when pollution becomes
		// unmanageable".
		isolate: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/**/index.ts", "src/**/types.ts", "src/**/types/**", "src/testing/**"],
			reportsDirectory: "./coverage",
		},
		projects: [
			{
				extends: true,
				test: {
					name: "node",
					environment: "node",
					include: ["tests/**/*.test.ts"],
					exclude: [...JSDOM_PATTERNS, "**/node_modules/**", "**/dist/**", "tests/react/**"],
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
		alias: {
			obsidian: path.resolve(__dirname, "./src/testing/mocks/obsidian.ts"),
		},
	},
});
