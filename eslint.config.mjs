// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
	{
		ignores: ["node_modules/**", "main.js", "tests/**", "docs-site/**", "*.mjs", "*.cjs"],
	},
	{
		files: ["src/**/*.ts"],
		plugins: {
			obsidianmd,
		},
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			// Obsidian MD rules
			"obsidianmd/no-static-styles-assignment": "warn",
			"obsidianmd/no-tfile-tfolder-cast": "warn",
			"obsidianmd/detach-leaves": "warn",
			"obsidianmd/no-view-references-in-plugin": "warn",
			"obsidianmd/prefer-file-manager-trash-file": "warn",
			"obsidianmd/no-plugin-as-component": "warn",
			"obsidianmd/ui/sentence-case": "warn",
		},
	},
];
