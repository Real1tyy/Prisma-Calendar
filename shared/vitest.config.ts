import * as path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

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
	"tests/tabbed-container/**/*.test.ts",
	"tests/vault-table/**/*.test.ts",
	"tests/core/css-utils.test.ts",
	"tests/core/property-renderer.test.ts",
	"tests/file/file.test.ts",
	"tests/testing/approval.test.ts",
];

export default defineConfig({
	server: { fs: { allow: [".."] } },
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	test: {
		globals: true,
		testTimeout: 10000,
		exclude: ["**/node_modules/**", "**/dist/**", "tests/react/**"],
		setupFiles: ["./src/testing/obsidian-dom-setup.ts"],
		pool: "threads",
		isolate: false,
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
