import * as path from "node:path";
import { fileURLToPath } from "node:url";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { sharedVitestAliases, VITEST_POOL_OPTIONS } from "../shared/src/testing/vitest-aliases.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Specs that depend on jsdom-specific behaviour (CSS-color canonicalization,
// SVG serialization, WheelEvent semantics, etc.) are pinned to jsdom via
// JSDOM_PATTERNS below. Everything else runs under happy-dom — 3–5× cheaper
// environment init. Mirrors the pattern in Prisma-Calendar/vitest.config.ts.
//
//   - page-header/action-bar.test.tsx asserts on `el.style.color` canonical
//     form ("rgb(255, 0, 0)"). jsdom canonicalizes CSS colors; happy-dom
//     returns the literal hex.
const JSDOM_PATTERNS: string[] = ["tests/page-header/action-bar.test.tsx"];

const SHARED_EXCLUDE = ["**/node_modules/**", "**/dist/**"];

export default defineConfig({
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	test: {
		globals: true,
		testTimeout: 10000,
		environment: "jsdom",
		setupFiles: ["../shared/src/testing/obsidian-dom-setup.ts", "./tests/setup-rtl.ts"],
		exclude: SHARED_EXCLUDE,
		...VITEST_POOL_OPTIONS,
		projects: [
			{
				extends: true,
				test: {
					name: "dom",
					environment: "happy-dom",
					include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
					exclude: [...SHARED_EXCLUDE, ...JSDOM_PATTERNS],
					isolate: false,
				},
			},
			...(JSDOM_PATTERNS.length > 0
				? [
						{
							extends: true,
							test: {
								name: "jsdom",
								environment: "jsdom" as const,
								include: JSDOM_PATTERNS,
								isolate: false,
							},
						},
					]
				: []),
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/index.ts", "src/**/types.ts", "src/**/types/**"],
			reportsDirectory: "./coverage",
		},
	},
	resolve: {
		alias: [
			{ find: "obsidian", replacement: path.resolve(__dirname, "../shared/src/testing/mocks/obsidian.ts") },
			...sharedVitestAliases(__dirname),
		],
	},
});
