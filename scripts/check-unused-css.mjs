#!/usr/bin/env node
/**
 * Detect unused CSS classes and custom properties in Obsidian plugins.
 *
 * Cross-references CSS definitions in compiled styles.css against TypeScript
 * source references using the TypeScript Compiler API for accurate static
 * string expression evaluation (handles concatenation, ternaries, template
 * literals, type assertions).
 *
 * Usage:
 *   node check-unused-css.mjs <plugin-directory>       # scan one plugin
 *   node check-unused-css.mjs --all                    # scan every plugin
 *   node check-unused-css.mjs --all --summary          # one-line per plugin
 *   node check-unused-css.mjs <plugin-dir> --json      # machine-readable
 *   node check-unused-css.mjs <plugin-dir> --no-fail   # exit 0 on unused
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_EVALUATED_STRINGS = 500;
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git", "docs"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

// ─── CSS Parsing ─────────────────────────────────────────────────────────────

/** Strip comments, quoted strings, and url() values to prevent false class matches. */
function stripCssNoise(css) {
	css = css.replace(/\/\*[\s\S]*?\*\//g, " ");
	css = css.replace(/(["'])(?:(?!\1).)*\1/g, '""');
	css = css.replace(/url\([^)]*\)/g, "url()");
	return css;
}

/** Extract all CSS class selectors from cleaned CSS. */
function extractCssClasses(css) {
	const classes = new Set();
	for (const m of css.matchAll(/\.([_a-zA-Z][-_a-zA-Z0-9]*)/g)) {
		classes.add(m[1]);
	}
	return classes;
}

/** Extract all CSS custom property definitions (--var-name: value). */
function extractCssVariablesDefined(css) {
	const vars = new Set();
	for (const m of css.matchAll(/(--[_a-zA-Z0-9-]+)\s*:/g)) {
		vars.add(m[1]);
	}
	return vars;
}

/** Extract CSS custom properties referenced via var(). */
function extractCssVariablesUsed(css) {
	const vars = new Set();
	for (const m of css.matchAll(/var\(\s*(--[_a-zA-Z0-9-]+)/g)) {
		vars.add(m[1]);
	}
	return vars;
}

// ─── Plugin Prefix Detection ─────────────────────────────────────────────────

/**
 * Read the plugin's CSS prefix from src/constants.ts.
 *
 * Every plugin must export CSS_PREFIX in src/constants.ts per the
 * css-prefix-convention decision doc. This is the single source of truth.
 */
function detectCssPrefix(pluginDir) {
	const constantsPath = path.join(pluginDir, "src", "constants.ts");
	if (!fs.existsSync(constantsPath)) {
		return null;
	}
	const text = fs.readFileSync(constantsPath, "utf-8");
	const match = text.match(/CSS_PREFIX\s*=\s*["']([^"']+)["']/);
	return match ? match[1] : null;
}

/** Check if a class name belongs to this plugin (matches its prefix). */
function isPluginClass(name, prefixes) {
	return prefixes.some((p) => name.startsWith(p));
}

/** Check if a CSS variable belongs to this plugin. */
function isPluginVar(name, varPrefix) {
	return name.startsWith(varPrefix);
}

// ─── File Collection ─────────────────────────────────────────────────────────

/** Recursively collect source files, skipping irrelevant directories. */
function collectSourceFiles(dir) {
	const files = [];
	function walk(d) {
		for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) walk(path.join(d, entry.name));
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name);
				if (SOURCE_EXTENSIONS.has(ext) && !entry.name.endsWith(".d.ts")) {
					files.push(path.join(d, entry.name));
				}
			}
		}
	}
	walk(dir);
	return files;
}

// ─── TypeScript AST Analysis ─────────────────────────────────────────────────

/** Extract CSS-like tokens from a resolved string value. */
function addTokensFromText(text, classTokens, varTokens) {
	for (const m of text.matchAll(/[_a-zA-Z][-_a-zA-Z0-9]*/g)) {
		classTokens.add(m[0]);
	}
	for (const m of text.matchAll(/--[_a-zA-Z0-9-]+/g)) {
		varTokens.add(m[0]);
	}
}

/**
 * Recursively evaluate a TypeScript expression to resolve static string values.
 *
 * Returns string[] of all possible values, or null if the expression contains
 * dynamic (unresolvable) parts. Handles:
 * - String/numeric/template literals
 * - Binary + (concatenation) with cartesian product
 * - Ternary conditionals (both branches)
 * - Template expressions with ${} spans (cartesian product)
 * - Parenthesized expressions, type assertions, non-null assertions
 *
 * Bails out if the cartesian product exceeds MAX_EVALUATED_STRINGS.
 */
function evaluateStaticStringExpression(node) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return [node.text];
	}
	if (ts.isNumericLiteral(node)) {
		return [node.text];
	}
	if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
		const op = node.operator === ts.SyntaxKind.MinusToken ? "-" : "+";
		return [op + node.operand.text];
	}
	if (ts.isParenthesizedExpression(node)) {
		return evaluateStaticStringExpression(node.expression);
	}
	if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
		return evaluateStaticStringExpression(node.expression);
	}
	if (ts.isNonNullExpression(node)) {
		return evaluateStaticStringExpression(node.expression);
	}

	// Ternary: condition ? left : right — collect both branches
	if (ts.isConditionalExpression(node)) {
		const whenTrue = evaluateStaticStringExpression(node.whenTrue);
		const whenFalse = evaluateStaticStringExpression(node.whenFalse);
		if (whenTrue && whenFalse) {
			const combined = [...whenTrue, ...whenFalse];
			return combined.length <= MAX_EVALUATED_STRINGS ? combined : null;
		}
		return whenTrue || whenFalse || null;
	}

	// Binary + (string concatenation) — cartesian product of left × right
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		const left = evaluateStaticStringExpression(node.left);
		const right = evaluateStaticStringExpression(node.right);
		if (left && right) {
			if (left.length * right.length > MAX_EVALUATED_STRINGS) return null;
			const results = [];
			for (const l of left) {
				for (const r of right) {
					results.push(l + r);
				}
			}
			return results;
		}
		return null;
	}

	// Template expression: `head${span1}mid${span2}tail`
	if (ts.isTemplateExpression(node)) {
		let results = [node.head.text];

		for (const span of node.templateSpans) {
			const spanValues = evaluateStaticStringExpression(span.expression);
			if (!spanValues) return null;

			const tail = span.literal.text;
			const newResults = [];
			for (const prefix of results) {
				for (const sv of spanValues) {
					newResults.push(prefix + sv + tail);
				}
			}
			if (newResults.length > MAX_EVALUATED_STRINGS) return null;
			results = newResults;
		}
		return results;
	}

	return null;
}

/**
 * Walk a TypeScript AST and extract all CSS-related string tokens.
 * Uses evaluateStaticStringExpression for complex expressions,
 * falls back to extracting tokens from static template parts.
 */
function analyzeSourceFile(sourceFile) {
	const classTokens = new Set();
	const varTokens = new Set();

	function visit(node) {
		// Simple string literals and no-substitution templates
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			addTokensFromText(node.text, classTokens, varTokens);
		}
		// Binary expressions (string concatenation)
		else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
			const values = evaluateStaticStringExpression(node);
			if (values) {
				for (const v of values) addTokensFromText(v, classTokens, varTokens);
			}
			// Still recurse into children for partial extraction
			ts.forEachChild(node, visit);
			return;
		}
		// Template expressions with ${} spans
		else if (ts.isTemplateExpression(node)) {
			const values = evaluateStaticStringExpression(node);
			if (values) {
				for (const v of values) addTokensFromText(v, classTokens, varTokens);
			} else {
				// Fallback: extract tokens from the static parts of the template
				addTokensFromText(node.head.text, classTokens, varTokens);
				for (const span of node.templateSpans) {
					addTokensFromText(span.literal.text, classTokens, varTokens);
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return { classTokens, varTokens };
}

// ─── Dynamic Prefix Matching ─────────────────────────────────────────────────

/**
 * Find code tokens that look like CSS prefixes (ending with -) and mark all
 * CSS classes starting with that prefix as used.
 *
 * Handles patterns like: el.addClass("prisma-calendar-" + dayType)
 * where "prisma-calendar-" is a token that marks all prisma-calendar-* as used.
 */
function applyDynamicPrefixMatching(codeTokens, definedClasses, pluginPrefixes) {
	const usedByPrefix = new Set();
	const pluginPrefixSet = new Set(pluginPrefixes);
	const prefixTokens = [...codeTokens].filter(
		(t) => t.endsWith("-") && t.length > 6 && !pluginPrefixSet.has(t) && pluginPrefixes.some((p) => t.startsWith(p))
	);

	for (const prefixToken of prefixTokens) {
		for (const cls of definedClasses) {
			if (cls.startsWith(prefixToken)) {
				usedByPrefix.add(cls);
			}
		}
	}
	return usedByPrefix;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function findMonorepoRoot(startDir) {
	let dir = startDir;
	while (dir !== path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
		dir = path.dirname(dir);
	}
	throw new Error("Could not find monorepo root (pnpm-workspace.yaml)");
}

function getScriptKind(filePath) {
	const ext = path.extname(filePath);
	switch (ext) {
		case ".tsx":
			return ts.ScriptKind.TSX;
		case ".jsx":
			return ts.ScriptKind.JSX;
		case ".js":
		case ".mjs":
			return ts.ScriptKind.JS;
		default:
			return ts.ScriptKind.TS;
	}
}

/**
 * Scan a plugin for unused CSS. Pure function — returns results, does not exit.
 * Throws only for unrecoverable errors (missing styles.css, missing prefix).
 */
export function scanPlugin(pluginDir) {
	const pluginName = path.basename(pluginDir);
	const stylesPath = path.join(pluginDir, "styles.css");
	const srcDir = path.join(pluginDir, "src");

	if (!fs.existsSync(stylesPath)) {
		throw new Error(`No styles.css found at ${stylesPath}`);
	}
	if (!fs.existsSync(srcDir)) {
		throw new Error(`No src/ directory found at ${srcDir}`);
	}

	const prefix = detectCssPrefix(pluginDir);
	if (!prefix) {
		throw new Error(`Could not detect CSS prefix for ${pluginName} (expected CSS_PREFIX in src/constants.ts)`);
	}

	const pluginPrefixes = [prefix];
	const varPrefix = `--${prefix.replace(/-$/, "-")}`;

	const rawCss = fs.readFileSync(stylesPath, "utf-8");
	const cleanedCss = stripCssNoise(rawCss);

	const allClasses = extractCssClasses(cleanedCss);
	const allVarsDefined = extractCssVariablesDefined(cleanedCss);
	const cssVarsUsed = extractCssVariablesUsed(cleanedCss);

	const pluginClasses = new Set([...allClasses].filter((c) => isPluginClass(c, pluginPrefixes)));
	const pluginVars = new Set([...allVarsDefined].filter((v) => isPluginVar(v, varPrefix)));
	const usedVars = new Set(cssVarsUsed);

	const allCodeTokens = new Set();
	const allCodeVarTokens = new Set();

	const dirsToScan = [srcDir];
	try {
		const monorepoRoot = findMonorepoRoot(pluginDir);
		const sharedSrc = path.join(monorepoRoot, "shared", "src");
		if (fs.existsSync(sharedSrc)) dirsToScan.push(sharedSrc);
	} catch {
		// Not in a monorepo — skip shared
	}

	let fileCount = 0;
	for (const dir of dirsToScan) {
		const files = collectSourceFiles(dir);
		fileCount += files.length;

		for (const filePath of files) {
			const text = fs.readFileSync(filePath, "utf-8");
			const scriptKind = getScriptKind(filePath);
			const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, scriptKind);
			const { classTokens, varTokens } = analyzeSourceFile(sourceFile);

			for (const t of classTokens) allCodeTokens.add(t);
			for (const t of varTokens) allCodeVarTokens.add(t);
		}
	}

	const usedClasses = new Set();
	for (const cls of pluginClasses) {
		if (allCodeTokens.has(cls)) {
			usedClasses.add(cls);
			continue;
		}
		const stripped = cls.slice(prefix.length);
		if (stripped && allCodeTokens.has(stripped)) {
			usedClasses.add(cls);
		}
	}

	const dynamicMatches = applyDynamicPrefixMatching(allCodeTokens, pluginClasses, pluginPrefixes);
	for (const cls of dynamicMatches) usedClasses.add(cls);

	for (const v of pluginVars) {
		if (allCodeVarTokens.has(v) || usedVars.has(v)) usedVars.add(v);
	}

	const unusedClasses = [...pluginClasses].filter((c) => !usedClasses.has(c)).sort();
	const unusedVars = [...pluginVars].filter((v) => !usedVars.has(v)).sort();

	return {
		plugin: pluginName,
		pluginDir,
		prefix,
		fileCount,
		dirsScanned: dirsToScan.map((d) => path.relative(pluginDir, d)),
		totals: {
			allClasses: allClasses.size,
			allVars: allVarsDefined.size,
			pluginClasses: pluginClasses.size,
			pluginVars: pluginVars.size,
		},
		usage: {
			classesUsed: usedClasses.size,
			classesUnused: unusedClasses.length,
			varsUsed: usedVars.size,
			varsUnused: unusedVars.length,
		},
		unusedClasses,
		unusedVars,
	};
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function listAllPlugins() {
	const monorepoRoot = findMonorepoRoot(process.cwd());
	return fs
		.readdirSync(monorepoRoot, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => path.join(monorepoRoot, e.name))
		.filter((dir) => {
			const manifest = path.join(dir, "manifest.json");
			const styles = path.join(dir, "styles.css");
			const src = path.join(dir, "src");
			return fs.existsSync(manifest) && fs.existsSync(styles) && fs.existsSync(src);
		});
}

function printFullReport(result) {
	console.log(`🔍 Scanning ${result.plugin} for unused CSS...\n`);
	console.log(`  Styles:  styles.css`);
	console.log(`  Code:    ${result.dirsScanned.join(", ")}`);
	console.log(`  Files:   ${result.fileCount}`);
	console.log();
	console.log("  Totals");
	console.log(`    Classes in CSS:     ${result.totals.allClasses}`);
	console.log(`    Variables in CSS:   ${result.totals.allVars}`);
	console.log(`    Plugin classes:     ${result.totals.pluginClasses}`);
	console.log(`    Plugin variables:   ${result.totals.pluginVars}`);
	console.log();
	console.log("  Plugin usage");
	console.log(`    Classes:  ${result.usage.classesUsed} used, ${result.usage.classesUnused} unused`);
	console.log(`    Vars:     ${result.usage.varsUsed} used, ${result.usage.varsUnused} unused`);

	if (result.unusedClasses.length > 0) {
		console.log();
		console.log("  Unused plugin classes");
		for (const cls of result.unusedClasses) console.log(`    - .${cls}`);
	}
	if (result.unusedVars.length > 0) {
		console.log();
		console.log("  Unused plugin variables");
		for (const v of result.unusedVars) console.log(`    - ${v}`);
	}

	if (result.unusedClasses.length === 0 && result.unusedVars.length === 0) {
		console.log("\n  ✅ No unused CSS found!");
	}
}

function printSummaryLine(result) {
	const { classesUnused, varsUnused } = result.usage;
	const total = classesUnused + varsUnused;
	const status = total === 0 ? "✅" : "⚠ ";
	const parts = [];
	if (classesUnused > 0) parts.push(`${classesUnused} classes`);
	if (varsUnused > 0) parts.push(`${varsUnused} vars`);
	const detail = parts.length > 0 ? `${parts.join(", ")} unused` : "clean";
	console.log(`  ${status} ${result.plugin.padEnd(24)} ${detail}`);
}

function resolvePluginDir(arg) {
	if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) return path.resolve(arg);

	const monorepoRoot = findMonorepoRoot(process.cwd());
	const resolved = path.join(monorepoRoot, arg);
	if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;

	return null;
}

function parseArgs(argv) {
	const flags = {
		all: false,
		summary: false,
		json: false,
		noFail: false,
	};
	const positional = [];
	for (const arg of argv) {
		switch (arg) {
			case "--all":
				flags.all = true;
				break;
			case "--summary":
				flags.summary = true;
				break;
			case "--json":
				flags.json = true;
				break;
			case "--no-fail":
				flags.noFail = true;
				break;
			case "-h":
			case "--help":
				flags.help = true;
				break;
			default:
				if (arg.startsWith("--")) {
					console.error(`Unknown flag: ${arg}`);
					process.exit(1);
				}
				positional.push(arg);
		}
	}
	return { flags, positional };
}

function printHelp() {
	console.log(`Usage:
  check-unused-css.mjs <plugin-dir>          Scan one plugin (full report)
  check-unused-css.mjs <p1> <p2> ...         Scan multiple plugins
  check-unused-css.mjs --all                 Scan every plugin
  check-unused-css.mjs --all --summary       One-line report per plugin

Flags:
  --all          Scan every plugin with manifest.json + styles.css + src/
  --summary      Print one-line per plugin instead of full report
  --json         Machine-readable JSON output
  --no-fail      Always exit 0 (default: exit 2 when unused CSS found)
  -h, --help     Show this help

Exit codes:
  0  Clean (or --no-fail)
  1  Error (missing files, bad prefix, etc.)
  2  Unused CSS found`);
}

function main() {
	const { flags, positional } = parseArgs(process.argv.slice(2));

	if (flags.help) {
		printHelp();
		return;
	}

	let pluginDirs;
	if (flags.all) {
		pluginDirs = listAllPlugins();
	} else if (positional.length > 0) {
		pluginDirs = [];
		for (const arg of positional) {
			const resolved = resolvePluginDir(arg);
			if (!resolved) {
				console.error(`❌ Plugin directory not found: ${arg}`);
				process.exit(1);
			}
			pluginDirs.push(resolved);
		}
	} else {
		printHelp();
		process.exit(1);
	}

	const results = [];
	const errors = [];
	for (const dir of pluginDirs) {
		try {
			results.push(scanPlugin(dir));
		} catch (err) {
			errors.push({ plugin: path.basename(dir), error: err.message });
		}
	}

	if (flags.json) {
		console.log(JSON.stringify({ results, errors }, null, 2));
	} else if (flags.summary || results.length > 1) {
		const totalClasses = results.reduce((s, r) => s + r.usage.classesUnused, 0);
		const totalVars = results.reduce((s, r) => s + r.usage.varsUnused, 0);
		const dirty = results.filter((r) => r.usage.classesUnused + r.usage.varsUnused > 0).length;

		console.log(`🔍 CSS dead-code scan (${results.length} plugin${results.length === 1 ? "" : "s"})\n`);
		for (const r of results) printSummaryLine(r);
		if (errors.length > 0) {
			console.log();
			for (const e of errors) console.log(`  ❌ ${e.plugin}: ${e.error}`);
		}
		console.log();
		if (totalClasses + totalVars === 0) {
			console.log(`  ✅ All ${results.length} plugin${results.length === 1 ? "" : "s"} clean`);
		} else {
			console.log(
				`  ⚠  ${dirty}/${results.length} plugin${results.length === 1 ? "" : "s"} with unused CSS — ${totalClasses} classes, ${totalVars} vars`
			);
			console.log(`     Run 'mise run check-unused-css <plugin>' for the full list`);
		}
	} else {
		for (const r of results) printFullReport(r);
		for (const e of errors) console.error(`❌ ${e.plugin}: ${e.error}`);
	}

	if (errors.length > 0) process.exit(1);

	const hasUnused = results.some((r) => r.usage.classesUnused + r.usage.varsUnused > 0);
	if (hasUnused && !flags.noFail) process.exit(2);
}

main();
