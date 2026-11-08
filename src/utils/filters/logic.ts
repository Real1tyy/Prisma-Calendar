import { buildPropertyMapping, sanitizeExpression } from "@real1ty/obsidian-plugins";
import jsep from "jsep";

import type { Frontmatter } from "../../types";

export function matchesSearch(searchValue: string, data: { title?: string; meta?: Frontmatter }): boolean {
	if (!searchValue) return true;
	const term = searchValue.toLowerCase();
	const title = (data.title || (data.meta?.["title"] as string) || "").toLowerCase();
	return title.includes(term);
}

export interface ExpressionMatcher {
	evaluate: (frontmatter: Frontmatter) => boolean;
	invalidate: () => void;
}

class InvalidExpressionError extends Error {}

const ALLOWED_BINARY_OPS = new Set([
	"===",
	"!==",
	"==",
	"!=",
	"<",
	"<=",
	">",
	">=",
	"+",
	"-",
	"*",
	"/",
	"%",
	"&&",
	"||",
]);

const ALLOWED_UNARY_OPS = new Set(["!", "-", "+"]);

const ALLOWED_METHOD_NAMES = new Set(["includes"]);

function evaluateNode(node: jsep.Expression, scope: Map<string, unknown>): unknown {
	switch (node.type) {
		case "Literal": {
			return (node as jsep.Literal).value;
		}
		case "Identifier": {
			const name = (node as jsep.Identifier).name;
			return scope.has(name) ? scope.get(name) : undefined;
		}
		case "UnaryExpression": {
			const u = node as jsep.UnaryExpression;
			if (!ALLOWED_UNARY_OPS.has(u.operator)) {
				throw new InvalidExpressionError(`Unsupported unary operator '${u.operator}'`);
			}
			const arg = evaluateNode(u.argument, scope);
			switch (u.operator) {
				case "!":
					return !arg;
				case "-":
					return -(arg as number);
				case "+":
					return Number(arg);
				default:
					throw new InvalidExpressionError(`Unsupported unary operator '${u.operator}'`);
			}
		}
		case "BinaryExpression": {
			const b = node as jsep.BinaryExpression;
			if (!ALLOWED_BINARY_OPS.has(b.operator)) {
				throw new InvalidExpressionError(`Unsupported binary operator '${b.operator}'`);
			}
			// Short-circuit logical operators — evaluate right side only when needed.
			if (b.operator === "&&") {
				const left = evaluateNode(b.left, scope);
				return left ? evaluateNode(b.right, scope) : left;
			}
			if (b.operator === "||") {
				const left = evaluateNode(b.left, scope);
				return left ? left : evaluateNode(b.right, scope);
			}
			const left = evaluateNode(b.left, scope);
			const right = evaluateNode(b.right, scope);
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
			return evaluateNode(c.test, scope) ? evaluateNode(c.consequent, scope) : evaluateNode(c.alternate, scope);
		}
		case "ArrayExpression": {
			const a = node as jsep.ArrayExpression;
			return a.elements.map((el) => (el === null ? null : evaluateNode(el, scope)));
		}
		case "MemberExpression": {
			const m = node as jsep.MemberExpression;
			if (m.computed) {
				throw new InvalidExpressionError("Computed member access is not allowed");
			}
			if (m.property.type !== "Identifier") {
				throw new InvalidExpressionError("Member access property must be an identifier");
			}
			const target = evaluateNode(m.object, scope);
			if (target == null) return undefined;
			// Block prototype-chain access (e.g., Tags.constructor, Priority.valueOf) by
			// requiring the property to be an own property of the value. This keeps the
			// surface to user-data nested access only.
			const key = (m.property as jsep.Identifier).name;
			if (typeof target === "object" && Object.prototype.hasOwnProperty.call(target, key)) {
				return (target as Record<string, unknown>)[key];
			}
			return undefined;
		}
		case "CallExpression": {
			const call = node as jsep.CallExpression;
			if (call.callee.type !== "MemberExpression") {
				throw new InvalidExpressionError("Only method calls of the form 'identifier.method(...)' are allowed");
			}
			const callee = call.callee as jsep.MemberExpression;
			if (callee.computed) {
				throw new InvalidExpressionError("Computed method calls are not allowed");
			}
			if (callee.property.type !== "Identifier") {
				throw new InvalidExpressionError("Method name must be an identifier");
			}
			const methodName = (callee.property as jsep.Identifier).name;
			if (!ALLOWED_METHOD_NAMES.has(methodName)) {
				throw new InvalidExpressionError(`Method '${methodName}' is not allowed`);
			}
			const target = evaluateNode(callee.object, scope);
			const args = call.arguments.map((a) => evaluateNode(a, scope));
			if (target == null) return false;
			if (methodName === "includes") {
				if (Array.isArray(target)) return target.includes(args[0]);
				if (typeof target === "string") return target.includes(String(args[0]));
				return false;
			}
			throw new InvalidExpressionError(`Method '${methodName}' is not allowed`);
		}
		case "ThisExpression": {
			throw new InvalidExpressionError("'this' is not allowed");
		}
		case "Compound":
		case "SequenceExpression": {
			throw new InvalidExpressionError("Sequence expressions are not allowed");
		}
		default:
			throw new InvalidExpressionError(`Unsupported expression node '${node.type}'`);
	}
}

export function evaluateExpression(expression: string, scope: Map<string, unknown>): boolean {
	const ast = jsep(expression);
	return Boolean(evaluateNode(ast, scope));
}

interface ExpressionEvaluator {
	/** Throws on a syntax error or a disallowed construct. */
	evaluate: (expression: string, frontmatter: Frontmatter) => boolean;
	reset: () => void;
}

function createExpressionEvaluator(): ExpressionEvaluator {
	let cachedAst: jsep.Expression | null = null;
	let cachedExpression: string | null = null;
	let propertyMapping = new Map<string, string>();

	function reset(): void {
		cachedAst = null;
		cachedExpression = null;
		propertyMapping.clear();
	}

	function evaluate(expression: string, frontmatter: Frontmatter): boolean {
		const currentKeys = new Set(Object.keys(frontmatter));
		const existingKeys = new Set(propertyMapping.keys());
		const hasNewKeys = [...currentKeys].some((key) => !existingKeys.has(key));

		if (hasNewKeys) {
			const allKeys = new Set([...existingKeys, ...currentKeys]);
			propertyMapping = buildPropertyMapping(Array.from(allKeys));
			cachedAst = null;
			cachedExpression = null;
		}

		if (!cachedAst || cachedExpression !== expression) {
			const sanitized = sanitizeExpression(expression, propertyMapping);
			cachedAst = jsep(sanitized);
			cachedExpression = expression;
		}

		const scope = new Map<string, unknown>();
		for (const [originalKey, sanitizedName] of propertyMapping) {
			scope.set(sanitizedName, frontmatter[originalKey] ?? undefined);
		}

		return Boolean(evaluateNode(cachedAst, scope));
	}

	return { evaluate, reset };
}

export class InvalidFilterExpressionError extends Error {
	constructor(
		readonly expression: string,
		cause: unknown
	) {
		super(`Invalid filter expression "${expression}": ${cause instanceof Error ? cause.message : String(cause)}`);
		this.name = "InvalidFilterExpressionError";
	}
}

export type FrontmatterPredicate = (frontmatter: Frontmatter) => boolean;

/**
 * The calendar view's expression filter for code that moves events in or out
 * of the vault (import, export, sync). Unlike `createExpressionMatcher`, an
 * invalid expression throws instead of matching nothing — for a sync, "match
 * nothing" would trash every synced note. See
 * [[spec-filter-imports-exports-and-sync-with-frontmatter-filter-expressions]].
 */
export function compileFrontmatterFilter(expression: string): FrontmatterPredicate {
	const trimmed = expression.trim();
	if (!trimmed) return () => true;

	const evaluator = createExpressionEvaluator();
	return (frontmatter) => {
		try {
			return evaluator.evaluate(trimmed, frontmatter);
		} catch (error) {
			throw new InvalidFilterExpressionError(trimmed, error);
		}
	};
}

export function createExpressionMatcher(getExpression: () => string): ExpressionMatcher {
	const evaluator = createExpressionEvaluator();
	let lastWarnedExpression: string | null = null;

	function invalidate(): void {
		evaluator.reset();
		lastWarnedExpression = null;
	}

	function evaluate(frontmatter: Frontmatter): boolean {
		const expression = getExpression();
		if (!expression) return true;

		try {
			return evaluator.evaluate(expression, frontmatter);
		} catch (error) {
			if (error instanceof ReferenceError) {
				return expression.includes("!==") || expression.includes("!=");
			}

			if (lastWarnedExpression !== expression) {
				console.warn("[ExpressionFilter] Invalid filter expression:", expression, error);
				lastWarnedExpression = expression;
			}
			return false;
		}
	}

	return { evaluate, invalidate };
}
