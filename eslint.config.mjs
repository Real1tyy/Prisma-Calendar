// Prisma-Calendar lint config. Production `src/**` runs typescript-eslint
// `strictTypeChecked` at ERROR; tests and the rest stay on the baseline below.
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import obsidianmd from "eslint-plugin-obsidianmd";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const STRICT_SRC = ["src/**/*.ts", "src/**/*.tsx"];
const STRICT_SRC_IGNORES = [
	"src/**/*.test.ts",
	"src/**/*.test.tsx",
	"src/**/*.spec.ts",
	"src/**/*.spec.tsx",
	"src/testing/**",
];

export default defineConfig([
	// Base recommended configs
	js.configs.recommended,
	...tseslint.configs.recommended,
	reactHooks.configs.flat.recommended,
	eslintConfigPrettier,

	// Config files, `.mjs`, and `stress/**` are excluded so `strictTypeChecked`'s
	// `projectService` doesn't fail on files that have no tsconfig project.
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
			"**/playwright-report/**",
			"**/test-results/**",
			"**/*.config.{js,mjs,cjs,ts}",
			"**/*.mjs",
			"stress/**",
		],
	},

	// TypeScript/JavaScript files configuration with type checking
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["**/*.config.ts", "**/vitest.config.ts"],
		plugins: {
			obsidianmd,
		},
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
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": [
				"error",
				{ checksVoidReturn: { arguments: false, attributes: false } },
			],
			"@typescript-eslint/consistent-type-imports": "error",
			"no-console": "off",
			"prefer-const": "error",
			"@typescript-eslint/no-unnecessary-condition": "warn",
			"obsidianmd/no-forbidden-elements": "error",
			"obsidianmd/no-plugin-as-component": "error",
			"obsidianmd/no-tfile-tfolder-cast": "warn",
			"obsidianmd/hardcoded-config-path": "error",
			// Tier 1 platform / API correctness — cheap (non-typed), high signal
			"obsidianmd/no-global-this": "error",
			"obsidianmd/platform": "error",
			"obsidianmd/prefer-window-timers": "error",
			"obsidianmd/regex-lookbehind": "error",
			"obsidianmd/object-assign": "error",
			"obsidianmd/detach-leaves": "error",
			"obsidianmd/editor-drop-paste": "error",
			"obsidianmd/vault/iterate": "error",
			"obsidianmd/no-static-styles-assignment": "warn",
			"obsidianmd/ui/sentence-case": "off",
			"obsidianmd/commands/no-plugin-id-in-command-id": "off",
			"obsidianmd/commands/no-plugin-name-in-command-name": "off",
			"obsidianmd/commands/no-command-in-command-id": "off",
			"obsidianmd/commands/no-command-in-command-name": "off",
			"obsidianmd/commands/no-default-hotkeys": "off",
			"obsidianmd/validate-manifest": "off",
			"obsidianmd/sample-names": "off",
		},
	},

	// strictTypeChecked at ERROR for production source only.
	...tseslint.config({
		files: STRICT_SRC,
		ignores: STRICT_SRC_IGNORES,
		extends: [tseslint.configs.strictTypeChecked],
		rules: {
			// The `no-unsafe-*` family is deferred: thousands of hits from Obsidian's
			// untyped `any` API surface — clearing them needs a typed API wrapper layer.
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			// Numbers in template literals are idiomatic and safe — keep the real
			// protection (objects/any/nullish) without churning every `${count}`.
			"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
			// Inline arrow shorthand (`onClick={() => doThing()}`) is fine — don't force
			// a braced body just because the call returns void.
			"@typescript-eslint/no-confusing-void-expression": "off",
			// `this: void` marks a method safe to pass unbound (satisfies `unbound-method`);
			// `void` as a generic type arg (`openReactModal<void>()`) is fine too. Options
			// replace defaults, so both must be stated.
			"@typescript-eslint/no-invalid-void-type": [
				"error",
				{ allowAsThisParameter: true, allowInGenericTypeArguments: true },
			],
		},
	}),

	// Test files and testing utilities — relax strict rules for mocks/test doubles.
	{
		files: [
			"**/*.test.ts",
			"**/*.test.tsx",
			"**/*.spec.ts",
			"**/*.spec.tsx",
			"**/tests/**/*.ts",
			"**/tests/**/*.tsx",
			"**/src/testing/**/*.ts",
		],
		rules: {
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unnecessary-condition": "off",
			"obsidianmd/hardcoded-config-path": "off",
			"obsidianmd/no-tfile-tfolder-cast": "off",
			// Tests poke `.style` directly to assert DOM cleanup (e.g. unmount clears inline styles).
			"obsidianmd/no-static-styles-assignment": "off",
		},
	},

	// Test environment polyfills install bare globals on `globalThis`.
	{
		files: [
			"**/src/testing/setup-window.ts",
			"**/src/testing/obsidian-dom-setup.ts",
			"**/tests/mocks/obsidian.ts",
			"**/tests/setup.ts",
		],
		rules: {
			"obsidianmd/no-global-this": "off",
			"obsidianmd/platform": "off",
		},
	},

	// Playwright fixture / e2e spec files.
	{
		files: ["**/e2e/fixtures/**/*.ts", "**/e2e/specs/**/*.ts"],
		rules: {
			"react-hooks/rules-of-hooks": "off",
			"obsidianmd/hardcoded-config-path": "off",
			// E2E tests run in the Playwright Node host, not the Obsidian renderer —
			// `activeDocument` and other Obsidian globals are unavailable there.
			"obsidianmd/platform": "off",
		},
	},
	{
		files: ["**/src/testing/e2e/**/*.ts", "**/e2e/specs/**/*.ts", "**/e2e/fixtures/**/*.ts"],
		rules: {
			"obsidianmd/prefer-window-timers": "off",
		},
	},
]);
