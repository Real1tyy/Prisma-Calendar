import type { Frontmatter } from "../types";
import { buildPropertyMapping, sanitizeExpression } from "./expression-utils";

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

export function createExpressionMatcher(getExpression: () => string): ExpressionMatcher {
	let compiledFunc: ((...args: unknown[]) => boolean) | null = null;
	let propertyMapping = new Map<string, string>();
	let lastWarnedExpression: string | null = null;

	function invalidate(): void {
		compiledFunc = null;
		propertyMapping.clear();
		lastWarnedExpression = null;
	}

	function evaluate(frontmatter: Frontmatter): boolean {
		const expression = getExpression();
		if (!expression) return true;

		try {
			const currentKeys = new Set(Object.keys(frontmatter));
			const existingKeys = new Set(propertyMapping.keys());
			const hasNewKeys = [...currentKeys].some((key) => !existingKeys.has(key));

			if (hasNewKeys) {
				const allKeys = new Set([...existingKeys, ...currentKeys]);
				propertyMapping = buildPropertyMapping(Array.from(allKeys));
				compiledFunc = null;
			}

			if (!compiledFunc) {
				const sanitized = sanitizeExpression(expression, propertyMapping);
				const params = Array.from(propertyMapping.values());
				compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (...args: unknown[]) => boolean;
			}

			const values = Array.from(propertyMapping.keys()).map((key) => frontmatter[key] ?? undefined);
			return compiledFunc(...values);
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
