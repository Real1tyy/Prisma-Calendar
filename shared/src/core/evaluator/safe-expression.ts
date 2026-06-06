import jsepNew from "@jsep-plugin/new";
import jsep from "jsep";

import { buildPropertyMapping, extractExpressionIdentifiers, sanitizeExpression } from "../../utils/expression-utils";

/**
 * A safe evaluator for the frontmatter filter/colour-rule DSL.
 *
 * Filter/colour rules and graph-filter presets are persisted in `data.json` — which the threat
 * model treats as untrusted (synced vaults, importable community preset packs). The previous
 * implementation compiled rule strings with `new Function(...)`, a remote-code-execution sink in
 * Electron (e.g. `[].constructor.constructor("return process")()` escapes to full Node access).
 *
 * Parsing is delegated to {@link https://github.com/EricSmekens/jsep | jsep} (the same expression
 * parser already used by Prisma's filter bar), so we never hand-roll a tokeniser. The jsep AST is
 * then interpreted against an explicit allow-list of operators, member reads (own-properties only)
 * and method/global calls. No source is ever compiled to code, and there is no reachable path to
 * the `Function` constructor or any global.
 */

// Extend the shared jsep singleton once: `new` (for the documented `new Date(...)` date filters)
// and `typeof` as a prefix operator. Registering globally is safe — every consumer routes its AST
// through an allow-list interpreter that rejects anything it does not explicitly permit.
jsep.plugins.register(jsepNew);
jsep.addUnaryOp("typeof");

export class InvalidExpressionError extends Error {}

export type SafeExpressionNode = jsep.Expression;

interface NewExpressionNode {
	type: "NewExpression";
	callee: jsep.Expression;
	arguments: jsep.Expression[];
}

// ── Allow-lists ────────────────────────────────────────────────────────────────
// Method calls permitted on user values (strings/arrays). All are pure and take primitive
// arguments only — none can execute caller-supplied code.
const ALLOWED_METHODS = new Set([
	"includes",
	"startsWith",
	"endsWith",
	"indexOf",
	"lastIndexOf",
	"toLowerCase",
	"toUpperCase",
	"trim",
	"trimStart",
	"trimEnd",
	"slice",
	"substring",
	"charAt",
	"at",
	"padStart",
	"padEnd",
	"repeat",
	"concat",
	"split",
	"replace",
	"replaceAll",
	"toString",
	"toFixed",
]);

// Bare global functions callable as `Fn(x)`.
const SIMPLE_GLOBAL_FNS: Record<string, (...args: unknown[]) => unknown> = {
	String: (...a) => String(a[0]),
	Number: (...a) => Number(a[0]),
	Boolean: (...a) => Boolean(a[0]),
	parseInt: (...a) => parseInt(a[0] as string, a[1] as number),
	parseFloat: (...a) => parseFloat(a[0] as string),
	isNaN: (...a) => isNaN(a[0] as number),
	isFinite: (...a) => isFinite(a[0] as number),
};

// Namespaced global functions callable as `Namespace.fn(x)`. Only these exact dotted paths
// resolve — `Array.constructor`, `Math.constructor`, etc. are never reachable.
const NAMESPACED_GLOBAL_FNS: Record<string, (...args: unknown[]) => unknown> = {
	"Array.isArray": (...a) => Array.isArray(a[0]),
	"Object.keys": (...a) => Object.keys(a[0] as object),
	"Object.values": (...a) => Object.values(a[0] as object),
	"Object.entries": (...a) => Object.entries(a[0] as object),
	"Math.abs": (...a) => Math.abs(a[0] as number),
	"Math.min": (...a) => Math.min(...(a as number[])),
	"Math.max": (...a) => Math.max(...(a as number[])),
	"Math.floor": (...a) => Math.floor(a[0] as number),
	"Math.ceil": (...a) => Math.ceil(a[0] as number),
	"Math.round": (...a) => Math.round(a[0] as number),
	"Math.trunc": (...a) => Math.trunc(a[0] as number),
	"Math.sign": (...a) => Math.sign(a[0] as number),
	"Math.pow": (...a) => Math.pow(a[0] as number, a[1] as number),
	"Math.sqrt": (...a) => Math.sqrt(a[0] as number),
};

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function memberName(node: jsep.Expression): string {
	if (node.type !== "Identifier") {
		throw new InvalidExpressionError("Member/method name must be a plain identifier");
	}
	return (node as jsep.Identifier).name;
}

/** The bare namespace name (`Array`, `Math`, …) if `node` is an identifier not shadowed by scope. */
function namespaceName(node: jsep.Expression, scope: Map<string, unknown>): string | null {
	return node.type === "Identifier" && !scope.has((node as jsep.Identifier).name)
		? (node as jsep.Identifier).name
		: null;
}

export function evaluateSafeAst(node: jsep.Expression, scope: Map<string, unknown>): unknown {
	switch (node.type) {
		case "Literal":
			return (node as jsep.Literal).value;

		case "Identifier": {
			const name = (node as jsep.Identifier).name;
			return scope.has(name) ? scope.get(name) : undefined;
		}

		case "ArrayExpression":
			return (node as jsep.ArrayExpression).elements.map((el) =>
				el == null ? null : evaluateSafeAst(el as jsep.Expression, scope)
			);

		case "NewExpression": {
			const n = node as unknown as NewExpressionNode;
			// Only `new Date(...)` is permitted — a pure, code-free constructor backing the
			// documented date-comparison filters. No other constructor is reachable.
			if (n.callee.type !== "Identifier" || (n.callee as jsep.Identifier).name !== "Date") {
				throw new InvalidExpressionError("Only 'new Date(...)' is supported");
			}
			const args = n.arguments.map((a) => evaluateSafeAst(a, scope));
			return args.length === 0 ? new Date() : new Date(args[0] as string | number | Date);
		}

		case "UnaryExpression": {
			const u = node as jsep.UnaryExpression;
			const arg = evaluateSafeAst(u.argument, scope);
			switch (u.operator) {
				case "!":
					return !arg;
				case "-":
					return -(arg as number);
				case "+":
					return Number(arg);
				case "typeof":
					return typeof arg;
				default:
					throw new InvalidExpressionError(`Unsupported unary operator '${u.operator}'`);
			}
		}

		case "BinaryExpression":
		case "LogicalExpression": {
			const b = node as jsep.BinaryExpression;
			// jsep emits `&&`/`||` as BinaryExpression — short-circuit them before evaluating right.
			if (b.operator === "&&") {
				const left = evaluateSafeAst(b.left, scope);
				return left ? evaluateSafeAst(b.right, scope) : left;
			}
			if (b.operator === "||") {
				const left = evaluateSafeAst(b.left, scope);
				return left ? left : evaluateSafeAst(b.right, scope);
			}
			const left = evaluateSafeAst(b.left, scope);
			const right = evaluateSafeAst(b.right, scope);
			switch (b.operator) {
				case "===":
					return left === right;
				case "!==":
					return left !== right;
				case "==":
					return left == right;
				case "!=":
					return left != right;
				case "<":
					return (left as number) < (right as number);
				case "<=":
					return (left as number) <= (right as number);
				case ">":
					return (left as number) > (right as number);
				case ">=":
					return (left as number) >= (right as number);
				case "+":
					return (left as number) + (right as number);
				case "-":
					return (left as number) - (right as number);
				case "*":
					return (left as number) * (right as number);
				case "/":
					return (left as number) / (right as number);
				case "%":
					return (left as number) % (right as number);
				default:
					throw new InvalidExpressionError(`Unsupported binary operator '${b.operator}'`);
			}
		}

		case "ConditionalExpression": {
			const c = node as jsep.ConditionalExpression;
			return evaluateSafeAst(c.test, scope)
				? evaluateSafeAst(c.consequent, scope)
				: evaluateSafeAst(c.alternate, scope);
		}

		case "MemberExpression": {
			const m = node as jsep.MemberExpression;
			if (m.computed) throw new InvalidExpressionError("Computed member access is not allowed");
			const key = memberName(m.property);
			const target = evaluateSafeAst(m.object, scope);
			if (target == null) return undefined;
			if (DANGEROUS_KEYS.has(key)) return undefined;
			if (key === "length" && (typeof target === "string" || Array.isArray(target))) {
				return target.length;
			}
			if (typeof target === "object" && Object.prototype.hasOwnProperty.call(target, key)) {
				return (target as Record<string, unknown>)[key];
			}
			return undefined;
		}

		case "CallExpression": {
			const call = node as jsep.CallExpression;
			const callee = call.callee;
			const evalArgs = (): unknown[] => call.arguments.map((a) => evaluateSafeAst(a, scope));

			if (callee.type === "Identifier") {
				const fn = SIMPLE_GLOBAL_FNS[(callee as jsep.Identifier).name];
				if (fn) return fn(...evalArgs());
				throw new InvalidExpressionError(`Unknown function '${(callee as jsep.Identifier).name}'`);
			}

			if (callee.type === "MemberExpression") {
				const memberCallee = callee as jsep.MemberExpression;
				if (memberCallee.computed) throw new InvalidExpressionError("Computed method calls are not allowed");
				const method = memberName(memberCallee.property);

				const ns = namespaceName(memberCallee.object, scope);
				if (ns !== null) {
					const globalFn = NAMESPACED_GLOBAL_FNS[`${ns}.${method}`];
					if (globalFn) return globalFn(...evalArgs());
				}

				if (!ALLOWED_METHODS.has(method)) {
					throw new InvalidExpressionError(`Method '${method}' is not allowed`);
				}
				const target = evaluateSafeAst(memberCallee.object, scope);
				if (target == null) return undefined;
				const fn = (target as Record<string, unknown>)[method];
				if (typeof fn !== "function") throw new InvalidExpressionError(`'${method}' is not a function`);
				return (fn as (...args: unknown[]) => unknown).apply(target, evalArgs());
			}

			throw new InvalidExpressionError("Unsupported call expression");
		}

		default:
			throw new InvalidExpressionError(`Unsupported expression node '${node.type}'`);
	}
}

/** Parse a (sanitised) expression string into a safe jsep AST. Throws on syntax jsep rejects. */
export function parseSafeExpression(expression: string): SafeExpressionNode {
	return jsep(expression);
}

/**
 * Evaluate a frontmatter predicate expression safely. Property names (including those with
 * spaces/hyphens) are mapped to safe identifiers, then the expression is parsed and interpreted.
 *
 * Returns the boolean result. Throws {@link InvalidExpressionError} (or a jsep parse error) for
 * malformed or disallowed expressions — callers decide how a broken rule should behave.
 */
export function evaluateSafeExpression(expression: string, frontmatter: Record<string, unknown>): boolean {
	const trimmed = expression.trim();
	if (!trimmed) return true;

	const keys = new Set(Object.keys(frontmatter));
	for (const id of extractExpressionIdentifiers(trimmed)) keys.add(id);

	const mapping = buildPropertyMapping(Array.from(keys));
	const sanitized = sanitizeExpression(trimmed, mapping);
	const ast = parseSafeExpression(sanitized);

	const scope = new Map<string, unknown>();
	for (const [original, mapped] of mapping) {
		scope.set(mapped, frontmatter[original] ?? undefined);
	}

	return Boolean(evaluateSafeAst(ast, scope));
}
