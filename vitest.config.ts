import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
	},
	resolve: {
		alias: {
			// Mock obsidian for testing
			obsidian: path.resolve(__dirname, "../../libs/utils/src/testing/mocks/obsidian.ts"),
			"@obsidian-plugins/watchdog-plugin": path.resolve(
				__dirname,
				"../../libs/watchdog-plugin/src/index.ts"
			),
			// Utils alias - use wildcard pattern
			utils: path.resolve(__dirname, "../../libs/utils/src"),
		},
	},
});
