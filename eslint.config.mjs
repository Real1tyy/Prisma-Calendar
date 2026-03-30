// eslint.config.mjs
import js from "@eslint/js";
import obsidianmd from "eslint-plugin-obsidianmd";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
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

	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,

	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
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
				getComputedStyle: "readonly",
				HTMLElement: "readonly",
				HTMLInputElement: "readonly",
				HTMLTextAreaElement: "readonly",
				HTMLSelectElement: "readonly",
				HTMLDivElement: "readonly",
				Event: "readonly",
				KeyboardEvent: "readonly",
				MouseEvent: "readonly",
				MutationObserver: "readonly",
				ResizeObserver: "readonly",
				IntersectionObserver: "readonly",
				DOMParser: "readonly",
				fetch: "readonly",
				AbortController: "readonly",
				URL: "readonly",
				Blob: "readonly",
				File: "readonly",
				FormData: "readonly",
				Response: "readonly",
				Headers: "readonly",
				CustomEvent: "readonly",
			},
		},
		rules: {
			"import/no-extraneous-dependencies": "off",
			"no-console": "off",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/await-thenable": "error",
			"@typescript-eslint/only-throw-error": "error",
			"@typescript-eslint/no-misused-promises": [
				"error",
				{ checksVoidReturn: { arguments: false, attributes: false } },
			],
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/no-implied-eval": "off",
			"obsidianmd/ui/sentence-case": "off",
			"obsidianmd/no-static-styles-assignment": "off",
			"obsidianmd/no-tfile-tfolder-cast": "warn",
			"@typescript-eslint/no-redundant-type-constituents": "off",
			"@typescript-eslint/no-base-to-string": "off",
			"@typescript-eslint/no-deprecated": "warn",
			"@microsoft/sdl/no-inner-html": "off",
		},
	},

	{
		files: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*.ts"],
		languageOptions: {
			globals: {
				global: "readonly",
			},
		},
		rules: {
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"@microsoft/sdl/no-inner-html": "off",
			"@typescript-eslint/no-deprecated": "off",
			"@typescript-eslint/await-thenable": "off",
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
]);
