import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
		// Playwright owns *.visual.spec.ts — vitest should skip them.
		exclude: ["**/node_modules/**", "**/dist/**", "**/*.visual.spec.ts"],
		server: {
			deps: {
				inline: ["@real1ty-obsidian-plugins"],
			},
		},
	},
	resolve: {
		alias: [
			{ find: "obsidian", replacement: path.resolve(__dirname, "tests/mocks/obsidian.ts") },
			{
				find: "@real1ty-obsidian-plugins/testing/visual",
				replacement: path.resolve(__dirname, "../shared/src/testing/visual/index.ts"),
			},
			{
				find: "@real1ty-obsidian-plugins/testing",
				replacement: path.resolve(__dirname, "../shared/src/testing/index.ts"),
			},
			{
				find: "@real1ty-obsidian-plugins-react",
				replacement: path.resolve(__dirname, "../shared/src/react/index.ts"),
			},
		],
		extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
	},
	// Ensure external dependencies can find obsidian
	define: {
		global: "globalThis",
	},
});
