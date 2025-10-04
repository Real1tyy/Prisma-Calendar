import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
		server: {
			deps: {
				inline: ["@real1ty-obsidian-plugins/utils", "@real1ty-obsidian-plugins/common-plugin"],
			},
		},
	},
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "tests/mocks/obsidian.ts"),
		},
		extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
	},
	// Ensure external dependencies can find obsidian
	define: {
		global: "globalThis",
	},
});
