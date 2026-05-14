#!/usr/bin/env node
/**
 * Detect unused CSS classes and custom properties in Obsidian plugins, and
 * (with --undefined-classes) the inverse: code references to classes that
 * are not defined in styles.css or any runtime stylesheet builder.
 *
 * Cross-references CSS definitions in compiled styles.css against TypeScript
 * source references using the TypeScript Compiler API for accurate static
 * string expression evaluation (handles concatenation, ternaries, template
 * literals, type assertions).
 *
 * Usage:
 *   node check-unused-css.mjs <plugin-directory>            # unused scan
 *   node check-unused-css.mjs --all                         # every plugin
 *   node check-unused-css.mjs --all --summary               # one-line per plugin
 *   node check-unused-css.mjs <plugin-dir> --json           # machine-readable
 *   node check-unused-css.mjs <plugin-dir> --no-fail        # exit 0 on unused
 *   node check-unused-css.mjs <plugin-dir> --undefined-classes  # reverse check
 *   node check-unused-css.mjs <plugin-dir> --undefined-classes --suggest-allowlist
 *   node check-unused-css.mjs <plugin-dir> --no-unused      # only reverse check
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import url from "node:url";
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
 * Find code tokens that look like CSS prefixes and mark all CSS classes
 * matching that prefix as used. Handles two shapes of dynamic class building:
 *
 * 1. Explicit plugin-prefix on the call site:
 *      el.addClass("prisma-calendar-" + dayType)
 *    → token "prisma-calendar-" marks every prisma-calendar-* class as used.
 *
 * 2. Prefix added by a helper (cls/useScopedCls), so the call site only sees
 *    the suffix portion:
 *      cls(`stopwatch-${variant}-btn`)            → token "stopwatch-"
 *      <PropertyItem scope="event-preview-prop">  → token "event-preview-prop"
 *    → both mark prisma-{token}* classes (compared against the stripped class
 *      name, i.e. with the plugin prefix removed).
 *
 * Kebab-prefix candidates are selected structurally: a token qualifies only
 * if it contains a hyphen. JavaScript identifiers cannot contain hyphens, so
 * any token with one came from a string literal shaped like a CSS class
 * fragment — not a variable name like `item`, `btn`, or `onClick`. This is
 * a property of the token itself, not an arbitrary length threshold.
 */
function applyDynamicPrefixMatching(codeTokens, definedClasses, pluginPrefixes, prefix) {
	const usedByPrefix = new Set();
	const pluginPrefixSet = new Set(pluginPrefixes);

	const fullPrefixTokens = [...codeTokens].filter(
		(t) => t.endsWith("-") && t.length > 6 && !pluginPrefixSet.has(t) && pluginPrefixes.some((p) => t.startsWith(p))
	);
	for (const prefixToken of fullPrefixTokens) {
		for (const cls of definedClasses) {
			if (cls.startsWith(prefixToken)) usedByPrefix.add(cls);
		}
	}

	const kebabSuffixTokens = [...codeTokens].filter(
		(t) => t.includes("-") && !pluginPrefixes.some((p) => t.startsWith(p))
	);
	for (const cls of definedClasses) {
		if (usedByPrefix.has(cls)) continue;
		const stripped = cls.slice(prefix.length);
		if (!stripped) continue;
		for (const t of kebabSuffixTokens) {
			const probe = t.endsWith("-") ? t : `${t}-`;
			if (stripped === t || stripped.startsWith(probe)) {
				usedByPrefix.add(cls);
				break;
			}
		}
	}

	return usedByPrefix;
}

// ─── Reverse check: class-reference extraction ───────────────────────────────

const ALLOWLIST_OK_COMMENT = "css-undefined-ok";

/**
 * Sink table — every supported call/attr shape that attaches a class name.
 *
 * Each entry tells the walker:
 * - `prefixed`: does the helper auto-prepend the plugin CSS_PREFIX?
 * - `splitWhitespace`: are space-separated tokens valid in one string?
 *
 * The walker dispatches on call expressions, JSX attributes, and certain
 * object-literal properties (`{ cls: "..." }` in `createDiv` / `createEl`).
 */
const PREFIXED_CALL_NAMES = new Set(["cls", "addCls", "removeCls", "toggleCls", "hasCls"]);
const PREFIXED_HELPER_FACTORIES = new Set(["createCssUtils"]);
const RAW_DOM_CLASS_NAMES = new Set(["addClass", "removeClass", "toggleClass"]);
const RAW_DOM_LIST_OPS = new Set(["add", "remove", "toggle", "contains", "replace"]);
const SCOPE_HELPER_HOOKS = new Set(["useScopedCls", "useScoped", "useScopedStyles"]);

/** Resolve the name a call/identifier targets — handles bare ids, x.y access. */
function callTargetName(expr) {
	if (ts.isIdentifier(expr)) return { object: null, name: expr.text };
	if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
		// Stringify the object side without using getText() (parents may be absent).
		let objText = null;
		const inner = expr.expression;
		if (ts.isIdentifier(inner)) objText = inner.text;
		else if (ts.isPropertyAccessExpression(inner) && ts.isIdentifier(inner.name)) {
			// chain like `el.classList`
			objText = inner.name.text;
		} else if (inner.kind === ts.SyntaxKind.ThisKeyword) {
			objText = "this";
		}
		return { object: objText, name: expr.name.text };
	}
	return null;
}

/**
 * Pull class fragments out of a template literal whose spans (`${...}`) we
 * cannot resolve.
 *
 * For each whitespace-separated piece of the template, we classify by which
 * boundaries surround it:
 *   - `${expr}foo` — token touches a span on the LEFT and nothing on the right:
 *     this is a *fragment* (e.g. the `-btn` in `cls(\`stopwatch-${variant}-btn\`)`),
 *     not a valid anchor. Skip it.
 *   - `foo${expr}` — token touches a span on the RIGHT: this is an *anchor*
 *     for the upcoming `${}`. Emit as dynamic so the prefix-match path can
 *     resolve it.
 *   - bounded on both sides by whitespace or template start/end — this is a
 *     *complete* static class name. Emit as non-dynamic.
 *
 * Concrete examples:
 *
 *   cls(`stopwatch-${variant}-btn`)
 *     → anchors: ["stopwatch-"]            (NOT "-btn")
 *
 *   cls(`prefix-foo prefix-${variant}`)
 *     → completeClasses: ["prefix-foo"]
 *     → anchors: ["prefix-"]
 *
 *   cls(`foo-${a}-btn bar-${b}-icon`)
 *     → anchors: ["foo-", "bar-"]          (NOT "-btn", "-icon")
 */
function extractTemplateClasses(node) {
	const completeClasses = [];
	const anchors = [];

	const segments = [{ text: node.head.text, leftBoundary: "start", rightBoundary: "span" }];
	for (let i = 0; i < node.templateSpans.length; i++) {
		const isLast = i === node.templateSpans.length - 1;
		segments.push({
			text: node.templateSpans[i].literal.text,
			leftBoundary: "span",
			rightBoundary: isLast ? "end" : "span",
		});
	}

	for (const seg of segments) {
		const hasLeadWS = /^\s/.test(seg.text);
		const hasTrailWS = /\s$/.test(seg.text);
		const parts = seg.text.split(/\s+/).filter((p) => p.length > 0);

		for (let j = 0; j < parts.length; j++) {
			const token = parts[j];
			const isStart = j === 0;
			const isEnd = j === parts.length - 1;
			const touchesLeftSpan = seg.leftBoundary === "span" && isStart && !hasLeadWS;
			const touchesRightSpan = seg.rightBoundary === "span" && isEnd && !hasTrailWS;

			if (touchesLeftSpan) continue; // fragment after `${...}` — discard
			if (touchesRightSpan) {
				anchors.push(token); // dynamic prefix
			} else {
				completeClasses.push(token); // standalone class
			}
		}
	}

	return { completeClasses, anchors };
}

/**
 * Resolve a string expression into one or more emissions. Returns an array of
 * `{ values, dynamic }`. Most expressions yield exactly one emission, but
 * template literals with unresolved spans can yield TWO (the complete static
 * classes mixed into the template, plus the dynamic anchors before each `${}`).
 *
 * Conditionals with one dynamic branch: we deliberately keep only the known
 * branch's value with `dynamic: false`. Flipping it to `dynamic: true` would
 * allow prefix-match fallback against the known branch's class — that's more
 * permissive but also lets undefined-class bugs in the known branch slip past
 * if any neighboring class happens to share a prefix. The reverse check
 * already correctly ignores the unknowable branch, so we don't need to mark
 * the resolved one as fuzzy.
 */
function resolveStringValues(node) {
	const evaluated = evaluateStaticStringExpression(node);
	if (evaluated) return [{ values: evaluated, dynamic: false }];

	if (ts.isTemplateExpression(node)) {
		const { completeClasses, anchors } = extractTemplateClasses(node);
		const out = [];
		if (completeClasses.length > 0) out.push({ values: completeClasses, dynamic: false });
		if (anchors.length > 0) out.push({ values: anchors, dynamic: true });
		return out;
	}

	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return [{ values: [node.text], dynamic: false }];
	}

	return [];
}

/** True if `node`'s line is immediately preceded by a `// css-undefined-ok` comment. */
function hasInlineAllowComment(node, sourceFile) {
	const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
	if (!ranges) return false;
	for (const r of ranges) {
		const text = sourceFile.text.slice(r.pos, r.end);
		if (text.includes(ALLOWLIST_OK_COMMENT)) return true;
	}
	return false;
}

/** Get 1-based line number of a node, using `pos` (works without parent pointers). */
function nodeLine(node, sourceFile) {
	const start = ts.skipTrivia(sourceFile.text, node.pos);
	const { line } = sourceFile.getLineAndCharacterOfPosition(start);
	return line + 1;
}

/** Slice a short textual snippet from a node's position, parent-free. */
function nodeSnippet(node, sourceFile, max = 80) {
	const start = ts.skipTrivia(sourceFile.text, node.pos);
	const end = Math.min(node.end, start + max);
	return sourceFile.text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Walk the source file and emit class references via the sink dispatcher.
 * Each emitted ref carries:
 *   - tokens:     resolved class fragments (with whitespace split when applicable)
 *   - prefixed:   true if the sink prepends CSS_PREFIX (so tokens lack the prefix)
 *   - dynamic:    template literal had unresolved spans (use prefix-match fallback)
 *   - allow:      inline comment immediately above marked it as expected-undefined
 *   - source:     { file, line, snippet } for human-friendly reporting
 */
export function extractClassReferences(sourceFile, filePath) {
	const refs = [];

	function emit({ tokens, prefixed, dynamic, splitWhitespace, node, callText }) {
		const allow = hasInlineAllowComment(node, sourceFile);
		const finalTokens = [];
		for (const t of tokens) {
			if (t === undefined || t === null) continue;
			const str = String(t);
			if (splitWhitespace) {
				for (const part of str.split(/\s+/)) {
					if (part) finalTokens.push(part);
				}
			} else {
				const trimmed = str.trim();
				if (trimmed) finalTokens.push(trimmed);
			}
		}
		if (finalTokens.length === 0) return;
		refs.push({
			tokens: finalTokens,
			prefixed,
			dynamic,
			allow,
			source: {
				file: filePath,
				line: nodeLine(node, sourceFile),
				snippet: callText,
			},
		});
	}

	function visitCall(node) {
		const target = callTargetName(node.expression);
		if (!target) return;

		const { object, name } = target;

		// cls(...) and friends — prefixed, supports whitespace-separated tokens.
		if (PREFIXED_CALL_NAMES.has(name)) {
			const startArg = name === "cls" ? 0 : 1; // addCls(el, "foo", "bar") → args[1..]
			for (let i = startArg; i < node.arguments.length; i++) {
				for (const emission of resolveStringValues(node.arguments[i])) {
					if (emission.values.length === 0) continue;
					emit({
						tokens: emission.values,
						prefixed: true,
						dynamic: emission.dynamic,
						splitWhitespace: true,
						node,
						callText: nodeSnippet(node, sourceFile),
					});
				}
			}
			return;
		}

		// useScopedCls("scope") — the curried call later is hit on its own.
		// The scope literal itself is not a class; it's a prefix anchor consumed
		// dynamically downstream. We do NOT emit anything for the scope literal.
		if (SCOPE_HELPER_HOOKS.has(name)) {
			return;
		}

		// useScopedStyles("scope", buildXStyles) — caller imports the build fn,
		// scope literal isn't a class either. Builder classes are added in Phase 3.
		// (Already handled by the SCOPE_HELPER_HOOKS short-circuit above.)

		// addClass/removeClass/toggleClass (Obsidian DOM) — raw class, no split.
		if (object && RAW_DOM_CLASS_NAMES.has(name)) {
			for (const arg of node.arguments) {
				for (const emission of resolveStringValues(arg)) {
					if (emission.values.length === 0) continue;
					emit({
						tokens: emission.values,
						prefixed: false,
						dynamic: emission.dynamic,
						splitWhitespace: false,
						node,
						callText: nodeSnippet(node, sourceFile),
					});
				}
			}
			return;
		}

		// classList.add/remove/toggle/contains — raw class, varargs, whitespace split safe.
		if (object && object.endsWith("classList") && RAW_DOM_LIST_OPS.has(name)) {
			for (const arg of node.arguments) {
				for (const emission of resolveStringValues(arg)) {
					if (emission.values.length === 0) continue;
					emit({
						tokens: emission.values,
						prefixed: false,
						dynamic: emission.dynamic,
						splitWhitespace: true,
						node,
						callText: nodeSnippet(node, sourceFile),
					});
				}
			}
			return;
		}

		// applyClsTokens(el, "prisma-foo prisma-bar") — raw (already-prefixed) tokens.
		if (name === "applyClsTokens") {
			if (node.arguments.length >= 2) {
				for (const emission of resolveStringValues(node.arguments[1])) {
					if (emission.values.length === 0) continue;
					emit({
						tokens: emission.values,
						prefixed: false,
						dynamic: emission.dynamic,
						splitWhitespace: true,
						node,
						callText: nodeSnippet(node, sourceFile),
					});
				}
			}
			return;
		}

		// createCssUtils(prefix) — not a class reference itself.
		if (PREFIXED_HELPER_FACTORIES.has(name)) return;

		// createDiv({ cls: "x" }) / createEl(tag, { cls: "x" }) — handled in
		// visitObjectLiteral. We don't intercept at the call level so that
		// arbitrary `{ cls }` objects passed to user functions are also caught.
	}

	function visitJsxAttribute(node) {
		if (!ts.isIdentifier(node.name)) return;
		if (node.name.text !== "className" && node.name.text !== "class") return;
		const init = node.initializer;
		if (!init) return;

		// className="literal" — direct string attribute.
		if (ts.isStringLiteral(init)) {
			emit({
				tokens: [init.text],
				prefixed: false,
				dynamic: false,
				splitWhitespace: true,
				node,
				callText: init.text.slice(0, 80),
			});
			return;
		}

		// className={expr} — recurse into the expression to harvest its statics.
		if (ts.isJsxExpression(init) && init.expression) {
			for (const emission of resolveStringValues(init.expression)) {
				if (emission.values.length === 0) continue;
				emit({
					tokens: emission.values,
					prefixed: false,
					dynamic: emission.dynamic,
					splitWhitespace: true,
					node,
					callText: nodeSnippet(init.expression, sourceFile),
				});
			}
		}
	}

	function visitClsProperty(node) {
		// Looking for object literal entries: `{ cls: "literal" }` or `{ cls: cls(...) }`.
		// The cls(...) branch is already covered by visitCall; here we only handle
		// raw string/template-literal values that wouldn't otherwise be seen as a
		// class reference (e.g. modal `cls: "prisma-x prisma-y"`).
		for (const prop of node.properties) {
			if (!ts.isPropertyAssignment(prop)) continue;
			const propName = prop.name;
			const keyText = ts.isIdentifier(propName) ? propName.text : ts.isStringLiteral(propName) ? propName.text : null;
			if (keyText !== "cls") continue;

			if (
				ts.isStringLiteral(prop.initializer) ||
				ts.isNoSubstitutionTemplateLiteral(prop.initializer) ||
				ts.isTemplateExpression(prop.initializer)
			) {
				for (const emission of resolveStringValues(prop.initializer)) {
					if (emission.values.length === 0) continue;
					emit({
						tokens: emission.values,
						prefixed: false,
						dynamic: emission.dynamic,
						splitWhitespace: true,
						node: prop,
						callText: `{ cls: ${nodeSnippet(prop.initializer, sourceFile, 60)} }`,
					});
				}
			}
		}
	}

	function visit(node) {
		if (ts.isCallExpression(node)) visitCall(node);
		else if (ts.isJsxAttribute(node)) visitJsxAttribute(node);
		else if (ts.isObjectLiteralExpression(node)) visitClsProperty(node);
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return refs;
}

// ─── Reverse check: runtime stylesheet extraction (Phase 3) ──────────────────

/**
 * Locate `*styles.ts` / `*.styles.ts` files reachable from a plugin and extract
 * the classes their builder functions inject. Each builder is expected to look
 * like:
 *
 *   export function buildFooStyles(cssPrefix: string): string {
 *     return `
 *       .${cssPrefix}foo { ... }
 *       .${cssPrefix}foo-row { ... }
 *     `;
 *   }
 *
 * We parse the file, find each `export function …(…): string { return `…`; }`,
 * resolve the template (substituting the first parameter wherever it appears
 * as `${cssPrefix}`), and harvest `.{class}` selectors from the resulting CSS.
 */
export function extractRuntimeStylesheetClasses(filePath, prefix) {
	const text = fs.readFileSync(filePath, "utf-8");
	const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, getScriptKind(filePath));
	const classes = new Set();

	function visit(node) {
		if (
			ts.isFunctionDeclaration(node) &&
			node.body &&
			node.parameters.length >= 1 &&
			node.parameters[0].name &&
			ts.isIdentifier(node.parameters[0].name)
		) {
			const paramName = node.parameters[0].name.text;
			const fnName = node.name?.text ?? "";
			// Heuristic: must be named like buildXxxStyles, and the first param looks
			// like a CSS prefix (literally named `cssPrefix`, `prefix`, or contains
			// `prefix`).
			const looksLikeBuilder = /^build[A-Z]\w*Styles?$/.test(fnName);
			const paramLooksPrefix = /prefix/i.test(paramName);
			if (looksLikeBuilder && paramLooksPrefix) {
				collectClassesFromBuilder(node, paramName);
			}
		}
		ts.forEachChild(node, visit);
	}

	function collectClassesFromBuilder(fn, paramName) {
		// Find every return statement and pull the template.
		function walk(n) {
			if (ts.isReturnStatement(n) && n.expression) {
				const css = renderTemplateWithPrefix(n.expression, paramName, prefix);
				if (css) {
					const cleaned = stripCssNoise(css);
					for (const cls of extractCssClasses(cleaned)) {
						// Discard classes contaminated by unresolved template spans
						// (the renderer substitutes them with `__SPAN__`). They aren't
						// real class names — keeping them would pollute definedClasses
						// and let bogus references slip past the reverse check.
						if (cls.includes("__SPAN__")) continue;
						classes.add(cls);
					}
				}
			}
			ts.forEachChild(n, walk);
		}
		walk(fn.body);
	}

	visit(sf);
	return classes;
}

/**
 * Render a template literal by substituting `${paramName}` with `prefix`. Other
 * span expressions stay as-is in the produced text (we don't care — we only
 * look for the structural `.{prefix}{class}` selectors).
 */
function renderTemplateWithPrefix(node, paramName, prefix) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	if (ts.isTemplateExpression(node)) {
		let out = node.head.text;
		for (const span of node.templateSpans) {
			let replacement = "";
			if (ts.isIdentifier(span.expression) && span.expression.text === paramName) {
				replacement = prefix;
			} else {
				// Generic placeholder; preserves selector boundaries elsewhere.
				replacement = "__SPAN__";
			}
			out += replacement + span.literal.text;
		}
		return out;
	}
	return null;
}

/**
 * Find every `*styles.ts` / `*.styles.ts` file under the dirs to scan.
 * Returns absolute paths.
 */
function findRuntimeStylesheetFiles(dirs) {
	const matches = [];
	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;
		function walk(d) {
			for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					if (!SKIP_DIRS.has(entry.name)) walk(path.join(d, entry.name));
				} else if (entry.isFile()) {
					if (entry.name === "styles.ts" || entry.name.endsWith(".styles.ts")) {
						matches.push(path.join(d, entry.name));
					}
				}
			}
		}
		walk(dir);
	}
	return matches;
}

// ─── Reverse check: built-in Obsidian/library external classes ──────────────

/**
 * Classes owned by Obsidian core or popular libraries we mount inside (never
 * defined in any plugin's styles.css). Treated as `external` automatically so
 * every plugin's allowlist stays small.
 *
 * Source: Obsidian's app.css naming conventions (`mod-*`, `is-*`,
 * `setting-item*`, `modal-*`, `clickable-icon`, `menu-*`, `dropdown`,
 * `checkbox-container`) and FullCalendar's `.fc-*` prefix.
 */
const BUILTIN_EXTERNAL_CLASSES = new Set([
	// Obsidian utility / state classes
	"clickable-icon",
	"dropdown",
	"is-active",
	"is-clickable",
	"is-disabled",
	"is-enabled",
	"is-loading",
	"is-mobile",
	"is-selected",
	"menu",
	"menu-item",
	"menu-item-title",
	"menu-item-icon",
	"menu-separator",
	"mod-cta",
	"mod-warning",
	"mod-error",
	"mod-mute",
	"mod-success",
	"modal",
	"modal-button-container",
	"modal-close-button",
	"modal-container",
	"modal-content",
	"modal-title",
	"setting-item",
	"setting-item-control",
	"setting-item-description",
	"setting-item-heading",
	"setting-item-info",
	"setting-item-name",
	"checkbox-container",
	"view-content",
	"view-header",
]);

/** True if a raw class name matches any built-in external prefix pattern. */
export function isBuiltinExternal(name) {
	if (BUILTIN_EXTERNAL_CLASSES.has(name)) return true;
	// FullCalendar (the calendar engine — every Obsidian calendar plugin uses it)
	if (name.startsWith("fc-")) return true;
	// CodeMirror (the editor we sit on top of)
	if (name.startsWith("cm-")) return true;
	// Frappe Gantt (the gantt engine)
	if (name.startsWith("gantt_")) return true;
	return false;
}

// ─── Reverse check: allowlist (Phase 4) ──────────────────────────────────────

/**
 * Load per-plugin allowlist from `<plugin>/scripts/css-allowlist.json`.
 * Shape:
 *   {
 *     "undefinedClasses": [
 *       { "pattern": "prisma-category-*", "reason": "…", "owner": "…" }
 *     ],
 *     "externalClasses": ["clickable-icon", …]
 *   }
 * `pattern` supports `*` only as a suffix glob. Reason is mandatory and
 * non-empty in `--strict` mode.
 */
function loadAllowlist(pluginDir) {
	const file = path.join(pluginDir, "scripts", "css-allowlist.json");
	if (!fs.existsSync(file)) {
		return { undefinedClasses: [], externalClasses: new Set(), file: null };
	}
	const raw = fs.readFileSync(file, "utf-8").trim();
	if (!raw) {
		// Empty file — treat as no allowlist so the user can run --suggest-allowlist
		// to populate it in place.
		return { undefinedClasses: [], externalClasses: new Set(), file };
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new Error(`Could not parse allowlist ${file}: ${err.message}`);
	}
	const undefinedClasses = Array.isArray(parsed.undefinedClasses) ? parsed.undefinedClasses : [];
	const externalClasses = new Set(Array.isArray(parsed.externalClasses) ? parsed.externalClasses : []);
	return { undefinedClasses, externalClasses, file };
}

/** True if the literal class `name` matches any allowlist undefined-classes pattern. */
export function matchesAllowlistPattern(name, undefinedEntries) {
	for (const entry of undefinedEntries) {
		const pat = entry.pattern;
		if (!pat) continue;
		if (pat.endsWith("*")) {
			if (name.startsWith(pat.slice(0, -1))) return true;
		} else if (name === pat) {
			return true;
		}
	}
	return false;
}

/**
 * Validate allowlist entries in strict mode. Returns an array of human-readable
 * issues. An empty array means the allowlist is release-ready.
 *
 * Strict mode fails on:
 *   - Empty / whitespace-only reasons
 *   - Placeholder reasons ("TODO", "...", "?", etc.)
 *   - `bootstrap: true` entries — these were auto-generated during the
 *     reverse-check rollout and must be reviewed (resolved or rewritten with a
 *     real reason and `bootstrap` removed) before release. Without this gate
 *     bootstrap entries fossilize: their reasons read like real explanations
 *     but were never authored by a human.
 */
export function validateAllowlistReasons(allowlist) {
	const issues = [];
	for (const entry of allowlist.undefinedClasses) {
		const reason = (entry.reason ?? "").trim();
		if (!reason) {
			issues.push(`Allowlist entry '${entry.pattern}' has no reason`);
			continue;
		}
		if (/^(tbd|todo|fixme|placeholder|\.\.\.|\?\?\?)$/i.test(reason)) {
			issues.push(`Allowlist entry '${entry.pattern}' has placeholder reason '${reason}'`);
			continue;
		}
		if (entry.bootstrap === true) {
			issues.push(
				`Allowlist entry '${entry.pattern}' is still marked bootstrap — resolve the underlying class or rewrite the entry with a real reason and drop \`bootstrap: true\``
			);
		}
	}
	return issues;
}

// ─── Reverse check: core check (Phase 2) ─────────────────────────────────────

/**
 * Decide whether a single class-reference token is recognized.
 *
 * - `prefixed`: the original sink prepends CSS_PREFIX → token lacks it.
 * - `dynamic`:  template literal had unresolved spans; allow prefix-match
 *               (token may end with `-` or simply be the static skeleton).
 *
 * Returns:
 *   { ok: true, via: "literal" | "prefix-builder" | "dynamic-suffix" |
 *                    "external" | "allowlist" | "inline-allow" }
 *   { ok: false }
 */
export function classifyClassRef(token, ref, ctx) {
	if (ref.allow) return { ok: true, via: "inline-allow" };

	const { prefix, definedClasses, allowlist } = ctx;

	// Built-in external classes (Obsidian, FullCalendar, CodeMirror, Gantt) —
	// these never need a per-plugin allowlist entry.
	if (!ref.prefixed && isBuiltinExternal(token)) {
		return { ok: true, via: "builtin-external" };
	}

	// External (third-party) classes — applies regardless of prefixed/dynamic.
	if (!ref.prefixed && allowlist.externalClasses.has(token)) {
		return { ok: true, via: "external" };
	}

	const full = ref.prefixed ? prefix + token : token;

	// Allowlist patterns are matched against the FULL (possibly-prefixed) name.
	if (matchesAllowlistPattern(full, allowlist.undefinedClasses)) {
		return { ok: true, via: "allowlist" };
	}

	// Literal match.
	if (definedClasses.has(full)) {
		return { ok: true, via: "literal" };
	}

	// Trailing-hyphen prefix-builder: `cls("daily-stats-")` matches any class
	// starting with `prisma-daily-stats-`.
	if (full.endsWith("-")) {
		for (const cls of definedClasses) {
			if (cls.startsWith(full)) return { ok: true, via: "prefix-builder" };
		}
	}

	// Dynamic-suffix: template literal couldn't resolve fully → accept prefix match.
	if (ref.dynamic) {
		const probe = full.endsWith("-") ? full : `${full}-`;
		for (const cls of definedClasses) {
			if (cls === full || cls.startsWith(probe)) return { ok: true, via: "dynamic-suffix" };
		}
	}

	// External class without prefix: if the unprefixed token already exists in
	// definedClasses (which would be a non-plugin class definition surfaced in
	// the cleaned CSS), accept. This catches the rare case where styles.css
	// itself has rules for `.is-active` etc.
	if (!ref.prefixed && definedClasses.has(token)) {
		return { ok: true, via: "literal" };
	}

	return { ok: false };
}

/**
 * Run the reverse check for one plugin. Pure function — returns the report.
 *
 * Inputs:
 *   - pluginDir: absolute path to the plugin
 *   - prefix: the plugin's CSS_PREFIX (e.g. "prisma-")
 *   - definedClasses: every class defined in styles.css (already extracted)
 *   - runtimeClasses: classes added by runtime stylesheet builders
 *   - dirsToScan: source dirs (plugin src + shared if monorepo)
 *   - allowlist: from loadAllowlist()
 */
function runReverseCheck({ pluginDir, prefix, definedClasses, runtimeClasses, dirsToScan, allowlist }) {
	const all = new Set([...definedClasses, ...runtimeClasses]);
	const ctx = { prefix, definedClasses: all, allowlist };

	const undefinedFindings = [];
	let totalRefs = 0;

	for (const dir of dirsToScan) {
		const files = collectSourceFiles(dir);
		for (const filePath of files) {
			const text = fs.readFileSync(filePath, "utf-8");
			const scriptKind = getScriptKind(filePath);
			const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, scriptKind);
			const refs = extractClassReferences(sourceFile, filePath);

			for (const ref of refs) {
				for (const token of ref.tokens) {
					totalRefs++;
					const verdict = classifyClassRef(token, ref, ctx);
					if (!verdict.ok) {
						undefinedFindings.push({
							token,
							full: ref.prefixed ? prefix + token : token,
							prefixed: ref.prefixed,
							dynamic: ref.dynamic,
							file: path.relative(pluginDir, ref.source.file),
							line: ref.source.line,
							snippet: ref.source.snippet,
						});
					}
				}
			}
		}
	}

	// Dedupe by (full, file, line).
	const seen = new Set();
	const dedup = [];
	for (const f of undefinedFindings) {
		const key = `${f.full}|${f.file}:${f.line}`;
		if (seen.has(key)) continue;
		seen.add(key);
		dedup.push(f);
	}
	dedup.sort((a, b) => a.full.localeCompare(b.full) || a.file.localeCompare(b.file) || a.line - b.line);

	return {
		totalRefs,
		definedCount: all.size,
		undefined: dedup,
		allowlistFile: allowlist.file,
	};
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
 *
 * Options:
 *   - unused:  run the forward scan (defined-but-unused classes/vars). Default true.
 *   - reverse: also run the reverse check (code → CSS) and include `reverse` in
 *              the result.
 *   - strict:  treat allowlist entries with empty/placeholder reasons or
 *              bootstrap markers as errors (pushed onto `result.allowlistIssues`).
 *
 * When `unused` is false the forward-scan AST walk is skipped entirely; the
 * `unusedClasses` / `unusedVars` fields come back empty and `usage` counts are
 * zeroed. The reverse check still runs if requested.
 */
export function scanPlugin(pluginDir, opts = {}) {
	const { unused = true, reverse = false, strict = false } = opts;
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
		// For the reverse check we surface this as a skipped state rather than
		// an unrecoverable error. The forward check still has no useful work
		// to do without a prefix, so we throw — callers that only care about
		// the reverse check can catch and inspect `code === "NO_PREFIX"`.
		const err = new Error(`Could not detect CSS prefix for ${pluginName} (expected CSS_PREFIX in src/constants.ts)`);
		err.code = "NO_PREFIX";
		throw err;
	}

	const pluginPrefixes = [prefix];
	const varPrefix = `--${prefix}`;

	const rawCss = fs.readFileSync(stylesPath, "utf-8");
	const cleanedCss = stripCssNoise(rawCss);

	const allClasses = extractCssClasses(cleanedCss);
	const allVarsDefined = extractCssVariablesDefined(cleanedCss);
	const cssVarsUsed = extractCssVariablesUsed(cleanedCss);

	const pluginClasses = new Set([...allClasses].filter((c) => isPluginClass(c, pluginPrefixes)));
	const pluginVars = new Set([...allVarsDefined].filter((v) => isPluginVar(v, varPrefix)));

	const dirsToScan = [srcDir];
	try {
		const monorepoRoot = findMonorepoRoot(pluginDir);
		for (const sharedDir of ["shared", "shared-react"]) {
			const sharedSrc = path.join(monorepoRoot, sharedDir, "src");
			if (fs.existsSync(sharedSrc)) dirsToScan.push(sharedSrc);
		}
	} catch {
		// Not in a monorepo — skip shared
	}

	let fileCount = 0;
	let unusedClasses = [];
	let unusedVars = [];
	let usedClassCount = 0;
	let usedVarCount = 0;

	if (unused) {
		const allCodeTokens = new Set();
		const allCodeVarTokens = new Set();
		const usedVarsSet = new Set(cssVarsUsed);

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

		const usedClassesSet = new Set();
		for (const cls of pluginClasses) {
			if (allCodeTokens.has(cls)) {
				usedClassesSet.add(cls);
				continue;
			}
			const stripped = cls.slice(prefix.length);
			if (stripped && allCodeTokens.has(stripped)) {
				usedClassesSet.add(cls);
			}
		}

		const dynamicMatches = applyDynamicPrefixMatching(allCodeTokens, pluginClasses, pluginPrefixes, prefix);
		for (const cls of dynamicMatches) usedClassesSet.add(cls);

		for (const v of pluginVars) {
			if (allCodeVarTokens.has(v)) usedVarsSet.add(v);
		}

		unusedClasses = [...pluginClasses].filter((c) => !usedClassesSet.has(c)).sort();
		unusedVars = [...pluginVars].filter((v) => !usedVarsSet.has(v)).sort();
		usedClassCount = usedClassesSet.size;
		usedVarCount = usedVarsSet.size;
	}

	let reverseReport = null;
	let allowlistIssues = [];
	if (reverse) {
		const allowlist = loadAllowlist(pluginDir);
		if (strict) allowlistIssues = validateAllowlistReasons(allowlist);
		// Reverse check: scan ONLY the plugin's own src/. Shared/shared-react use
		// scoped helpers (useScoped/useScopedCls) whose final class name depends
		// on the scope arg at the call site — not knowable from the cls() argument
		// alone. Their classes are still picked up via runtime stylesheet builders.
		const reverseDirs = [srcDir];
		// Runtime stylesheets: scan plugin src + all shared dirs (they ship CSS too).
		const runtimeClasses = new Set();
		for (const stylesFile of findRuntimeStylesheetFiles(dirsToScan)) {
			for (const cls of extractRuntimeStylesheetClasses(stylesFile, prefix)) {
				runtimeClasses.add(cls);
			}
		}
		reverseReport = runReverseCheck({
			pluginDir,
			prefix,
			// Accept any class defined anywhere in styles.css, not just the
			// prefix-filtered set. Some plugins (e.g. Fusion-Goals) ship classes
			// without the canonical prefix — those are not "plugin classes" per
			// the forward check but they ARE defined and the reverse check should
			// recognize them.
			definedClasses: allClasses,
			runtimeClasses,
			dirsToScan: reverseDirs,
			allowlist,
		});
		reverseReport.runtimeClassCount = runtimeClasses.size;
	}

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
			classesUsed: usedClassCount,
			classesUnused: unusedClasses.length,
			varsUsed: usedVarCount,
			varsUnused: unusedVars.length,
		},
		unusedClasses,
		unusedVars,
		reverse: reverseReport,
		allowlistIssues,
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

function printFullReport(result, flags = {}) {
	if (flags.noUnused !== true) {
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

	if (result.reverse) {
		const r = result.reverse;
		console.log();
		console.log(`🔍 Scanning ${result.plugin} for undefined CSS references...\n`);
		console.log(`  Code refs:    ${r.totalRefs}`);
		console.log(`  Defined:      ${r.definedCount} (${r.runtimeClassCount} from runtime builders)`);
		console.log(`  Undefined:    ${r.undefined.length}`);

		if (r.allowlistFile) {
			console.log(`  Allowlist:    ${path.relative(result.pluginDir, r.allowlistFile)}`);
		}

		if (r.undefined.length > 0) {
			console.log();
			console.log("  Undefined references");
			for (const f of r.undefined) {
				console.log(`    - .${f.full}${f.dynamic ? " (dynamic)" : ""}    ${f.file}:${f.line}`);
			}
		} else if (flags.noUnused === true) {
			console.log("\n  ✅ No undefined references found!");
		}

		if (result.allowlistIssues && result.allowlistIssues.length > 0) {
			console.log();
			console.log("  Allowlist issues (--strict)");
			for (const issue of result.allowlistIssues) console.log(`    - ${issue}`);
		}
	}
}

function printSummaryLine(result, flags = {}) {
	const { classesUnused, varsUnused } = result.usage;
	const undefinedCount = result.reverse ? result.reverse.undefined.length : 0;
	const allowlistIssueCount = result.allowlistIssues ? result.allowlistIssues.length : 0;
	const parts = [];
	if (!flags.noUnused) {
		if (classesUnused > 0) parts.push(`${classesUnused} classes unused`);
		if (varsUnused > 0) parts.push(`${varsUnused} vars unused`);
	}
	if (result.reverse && undefinedCount > 0) parts.push(`${undefinedCount} undefined`);
	if (allowlistIssueCount > 0) parts.push(`${allowlistIssueCount} allowlist issues`);

	const total = (flags.noUnused ? 0 : classesUnused + varsUnused) + undefinedCount + allowlistIssueCount;
	const status = total === 0 ? "✅" : "⚠ ";
	const detail = parts.length > 0 ? parts.join(", ") : "clean";
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
		undefinedClasses: false,
		noUnused: false,
		suggestAllowlist: false,
		strict: false,
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
			case "--undefined-classes":
				flags.undefinedClasses = true;
				break;
			case "--no-unused":
				flags.noUnused = true;
				break;
			case "--suggest-allowlist":
				flags.suggestAllowlist = true;
				flags.undefinedClasses = true;
				break;
			case "--strict":
				flags.strict = true;
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
  --all                  Scan every plugin with manifest.json + styles.css + src/
  --summary              Print one-line per plugin instead of full report
  --json                 Machine-readable JSON output
  --no-fail              Always exit 0 (default: exit 2 when issues found)
  --undefined-classes    Reverse check: code → CSS (find classes referenced
                         in code but not defined in styles.css or builders)
  --no-unused            Skip the original unused-class scan
  --suggest-allowlist    Print a starter allowlist JSON (implies --undefined-classes)
  --strict               Treat empty/placeholder allowlist reasons as errors
  -h, --help             Show this help

Exit codes:
  0  Clean (or --no-fail)
  1  Error (missing files, bad prefix, etc.)
  2  Unused CSS or undefined-class references found`);
}

/**
 * Build a suggested allowlist for one plugin from its reverse-check findings.
 * Returns the JSON shape expected by the loader: every distinct undefined
 * class becomes an entry. Bootstrap entries are tagged so future audits can
 * tell them apart from purposeful exemptions.
 */
function buildSuggestedAllowlist(result) {
	if (!result.reverse) return null;
	const out = {
		$schema: "../../scripts/utils/css-allowlist.schema.json",
		externalClasses: [],
		undefinedClasses: [],
	};
	const seenPatterns = new Set();
	for (const f of result.reverse.undefined) {
		if (seenPatterns.has(f.full)) continue;
		seenPatterns.add(f.full);
		out.undefinedClasses.push({
			pattern: f.full,
			reason:
				"Bootstrap: pre-existing undefined class identified during reverse-check rollout. " +
				"Either add a CSS rule under the canonical prefix, refactor the code to use a defined class, " +
				"or replace this entry with a real reason if the class is intentionally external.",
			source: `${f.file}:${f.line}`,
			bootstrap: true,
		});
	}
	return out;
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

	if (flags.noUnused && !flags.undefinedClasses) {
		console.error("❌ --no-unused only makes sense alongside --undefined-classes");
		console.error("   (without one of them this command has nothing to report)");
		process.exit(1);
	}

	const scanOpts = {
		unused: !flags.noUnused,
		reverse: flags.undefinedClasses,
		strict: flags.strict,
	};

	const results = [];
	const errors = [];
	const skipped = [];
	for (const dir of pluginDirs) {
		try {
			results.push(scanPlugin(dir, scanOpts));
		} catch (err) {
			if (err.code === "NO_PREFIX") {
				skipped.push({ plugin: path.basename(dir), reason: err.message });
			} else {
				errors.push({ plugin: path.basename(dir), error: err.message });
			}
		}
	}

	// --suggest-allowlist: emit JSON for the first plugin and exit cleanly.
	if (flags.suggestAllowlist) {
		if (results.length === 0) {
			console.error("❌ --suggest-allowlist needs at least one plugin to scan");
			process.exit(1);
		}
		if (results.length > 1) {
			console.error("❌ --suggest-allowlist only supports one plugin at a time");
			process.exit(1);
		}
		const suggestion = buildSuggestedAllowlist(results[0]);
		console.log(JSON.stringify(suggestion, null, 2));
		return; // never blocks
	}

	if (flags.json) {
		console.log(JSON.stringify({ results, errors, skipped }, null, 2));
	} else if (flags.summary || results.length > 1) {
		const totalClasses = flags.noUnused ? 0 : results.reduce((s, r) => s + r.usage.classesUnused, 0);
		const totalVars = flags.noUnused ? 0 : results.reduce((s, r) => s + r.usage.varsUnused, 0);
		const totalUndefined = results.reduce((s, r) => s + (r.reverse ? r.reverse.undefined.length : 0), 0);
		const totalAllowlistIssues = results.reduce((s, r) => s + (r.allowlistIssues ? r.allowlistIssues.length : 0), 0);
		const dirty = results.filter((r) => {
			const u =
				(flags.noUnused ? 0 : r.usage.classesUnused + r.usage.varsUnused) +
				(r.reverse ? r.reverse.undefined.length : 0) +
				(r.allowlistIssues ? r.allowlistIssues.length : 0);
			return u > 0;
		}).length;

		console.log(`🔍 CSS scan (${results.length} plugin${results.length === 1 ? "" : "s"})\n`);
		for (const r of results) printSummaryLine(r, flags);
		if (skipped.length > 0) {
			console.log();
			for (const s of skipped) console.log(`  ⊝ ${s.plugin.padEnd(24)} skipped (${s.reason})`);
		}
		if (errors.length > 0) {
			console.log();
			for (const e of errors) console.log(`  ❌ ${e.plugin}: ${e.error}`);
		}
		console.log();
		if (totalClasses + totalVars + totalUndefined + totalAllowlistIssues === 0) {
			console.log(`  ✅ All ${results.length} plugin${results.length === 1 ? "" : "s"} clean`);
		} else {
			const parts = [];
			if (!flags.noUnused) {
				if (totalClasses > 0) parts.push(`${totalClasses} unused classes`);
				if (totalVars > 0) parts.push(`${totalVars} unused vars`);
			}
			if (totalUndefined > 0) parts.push(`${totalUndefined} undefined`);
			if (totalAllowlistIssues > 0) parts.push(`${totalAllowlistIssues} allowlist issues`);
			console.log(
				`  ⚠  ${dirty}/${results.length} plugin${results.length === 1 ? "" : "s"} with issues — ${parts.join(", ")}`
			);
			console.log(`     Run 'mise run check-unused-css <plugin>' for the full list`);
		}
	} else {
		for (const r of results) printFullReport(r, flags);
		for (const s of skipped) console.warn(`⊝ ${s.plugin}: ${s.reason}`);
		for (const e of errors) console.error(`❌ ${e.plugin}: ${e.error}`);
	}

	if (errors.length > 0) process.exit(1);

	const allowlistIssueCount = results.reduce((s, r) => s + (r.allowlistIssues ? r.allowlistIssues.length : 0), 0);
	if (allowlistIssueCount > 0 && !flags.noFail) process.exit(2);

	const hasUnused = !flags.noUnused && results.some((r) => r.usage.classesUnused + r.usage.varsUnused > 0);
	const hasUndefined = results.some((r) => r.reverse && r.reverse.undefined.length > 0);
	if ((hasUnused || hasUndefined) && !flags.noFail) process.exit(2);
}

// Only run main() when invoked directly (not on import).
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
	main();
}
