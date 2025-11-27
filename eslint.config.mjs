// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		ignores: [
			"node_modules/**",
			"**/node_modules/**",
			"docs-site/**",
			"**/dist/**",
			"**/build/**",
			"main.js",
			"*.config.js",
			"*.config.mjs",
			"esbuild.config.mjs",
			"version-bump.mjs",
		],
	},
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./tsconfig.json",
			},
			globals: {
				console: "readonly",
				document: "readonly",
				window: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				requestAnimationFrame: "readonly",
				cancelAnimationFrame: "readonly",
				NodeJS: "readonly",
			},
		},
	},
]);
