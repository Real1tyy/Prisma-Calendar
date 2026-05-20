/** @type {import("prettier").Config} */
export default {
	useTabs: true,
	printWidth: 120,
	semi: true,
	singleQuote: false,
	trailingComma: "es5",
	bracketSpacing: true,
	arrowParens: "always",
	endOfLine: "lf",
	plugins: ["@ianvs/prettier-plugin-sort-imports"],
	importOrder: ["<BUILTIN_MODULES>", "", "<THIRD_PARTY_MODULES>", "", "^[.]"],
	importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
	importOrderTypeScriptVersion: "5.7.0",
};
