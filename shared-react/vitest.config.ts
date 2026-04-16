import * as path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	server: { fs: { allow: [".."] } },
	plugins: [tsconfigPaths({ ignoreConfigErrors: true })],
	test: {
		globals: true,
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
		alias: {
			obsidian: path.resolve(__dirname, "../shared/src/testing/mocks/obsidian.ts"),
			"@real1ty-obsidian-plugins/testing": path.resolve(__dirname, "../shared/src/testing/index.ts"),
			"@real1ty-obsidian-plugins": path.resolve(__dirname, "../shared/src/index.ts"),
		},
	},
});
