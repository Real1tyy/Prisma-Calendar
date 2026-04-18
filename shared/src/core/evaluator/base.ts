import { type BehaviorSubject, Subject, takeUntil } from "rxjs";

import { buildPropertyMapping, extractExpressionIdentifiers, sanitizeExpression } from "../../utils/expression-utils";

export interface BaseRule {
	id: string;
	expression: string;
	enabled: boolean;
}

/**
 * Generic base class for evaluating JavaScript expressions against frontmatter objects.
 * Provides reactive compilation of rules via RxJS subscription and safe evaluation.
 */
export abstract class BaseEvaluator<TRule extends BaseRule, TSettings> {
	protected rules: TRule[] = [];
	private compiledFunctions = new Map<string, ((...args: unknown[]) => boolean) | null>();
	private expressionIdCache = new Map<string, string[]>();
	private propertyMapping = new Map<string, string>();
	private readonly destroy$ = new Subject<void>();

	constructor(settingsStore: BehaviorSubject<TSettings>) {
		settingsStore.pipe(takeUntil(this.destroy$)).subscribe((settings) => {
			this.rules = this.extractRules(settings);
			this.compiledFunctions.clear();
			this.expressionIdCache.clear();
			this.propertyMapping.clear();
		});
	}

	protected abstract extractRules(settings: TSettings): TRule[];

	destroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this.compiledFunctions.clear();
		this.expressionIdCache.clear();
		this.propertyMapping.clear();
	}

	protected evaluateRule(rule: TRule, frontmatter: Record<string, unknown>): boolean {
		if (!rule.enabled || !rule.expression) {
			return false;
		}

		try {
			// Progressively build property mapping from frontmatter keys AND expression identifiers.
			// Expression identifiers must be included so that properties referenced in expressions
			// but missing from the frontmatter are passed as `undefined` instead of causing ReferenceError.
			const currentKeys = new Set(Object.keys(frontmatter));
			let expressionIds = this.expressionIdCache.get(rule.id);
			if (!expressionIds) {
				expressionIds = extractExpressionIdentifiers(rule.expression);
				this.expressionIdCache.set(rule.id, expressionIds);
			}
			for (const id of expressionIds) {
				currentKeys.add(id);
			}

			const existingKeys = new Set(this.propertyMapping.keys());
			const newKeys = [...currentKeys].filter((key) => !existingKeys.has(key));

			// If new properties are found, rebuild the mapping and invalidate compiled functions
			if (newKeys.length > 0) {
				const allKeys = new Set([...existingKeys, ...currentKeys]);
				this.propertyMapping = buildPropertyMapping(Array.from(allKeys));
				// Clear compiled functions since property mapping changed
				this.compiledFunctions.clear();
			}

			let compiledFunc = this.compiledFunctions.get(rule.id);

			if (!compiledFunc) {
				const sanitized = sanitizeExpression(rule.expression, this.propertyMapping);
				const params = Array.from(this.propertyMapping.values());

				compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (...args: unknown[]) => boolean;
				this.compiledFunctions.set(rule.id, compiledFunc);
			}

			// Use undefined for missing properties instead of letting them be undefined implicitly
			const values = Array.from(this.propertyMapping.keys()).map((key) => frontmatter[key] ?? undefined);
			const result = compiledFunc(...values);

			return result === true;
		} catch (error) {
			// Suppress ReferenceError logs - these occur when properties don't exist in frontmatter
			// which is expected behavior (e.g., Status === 'Done' when Status is undefined)
			if (error instanceof ReferenceError) {
				return false;
			}
			// Log other errors (syntax errors, etc.) as they indicate actual problems
			console.warn(`Invalid expression (${rule.id}):`, rule.expression, error);
			return false;
		}
	}

	protected isTruthy(value: unknown): boolean {
		return value === true;
	}
}
