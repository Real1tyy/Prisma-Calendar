import * as path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { sharedVitestAliases } from "../shared/src/testing/vitest-aliases.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	test: {
		globals: true,
		testTimeout: 10000,
		environment: "jsdom",
		setupFiles: ["../shared/src/testing/obsidian-dom-setup.ts", "./tests/setup-rtl.ts"],
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
