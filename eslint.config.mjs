import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
	// Base recommended configs
	js.configs.recommended,
	...tseslint.configs.recommended,
	eslintConfigPrettier,

	// Global ignores
	{
		ignores: [
			"**/node_modules/**",
			"**/dist/**",
			"**/main.js",
			"**/styles.css",
			"**/*.d.ts",
			"**/docs-site/**",
			"**/.obsidian/**",
			"**/build/**",
			"**/coverage/**",
			"**/.cache/**",
			".eslintcache",
			"**/htmlcov/**",
		],
	},

	// Config files - no type checking
	{
		files: [
			"**/*.config.{js,mjs,ts}",
			"**/esbuild.config.mjs",
			"**/vitest.config.ts",
			"**/version-bump.mjs",
			".prettierrc.mjs",
		],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.node,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "off",
			"no-console": "off",
			"prefer-const": "error",
		},
	},

	// TypeScript/JavaScript files configuration with type checking
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["**/*.config.ts", "**/vitest.config.ts"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"no-console": "off",
			"prefer-const": "error",
		},
	},

	// Regular JavaScript files
	{
		files: ["**/*.js", "**/*.mjs"],
		ignores: ["**/*.config.{js,mjs}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		rules: {
			"no-console": "off",
			"prefer-const": "error",
		},
	},

	// TypeScript declaration files
	{
		files: ["**/*.d.ts"],
		rules: {
			"@typescript-eslint/triple-slash-reference": "off",
		},
	},
];
