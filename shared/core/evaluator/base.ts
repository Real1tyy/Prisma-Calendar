import type { BehaviorSubject, Subscription } from "rxjs";

import { buildPropertyMapping, sanitizeExpression } from "../expression-utils";

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
	private propertyMapping = new Map<string, string>();
	private subscription: Subscription | null = null;

	constructor(settingsStore: BehaviorSubject<TSettings>) {
		this.subscription = settingsStore.subscribe((settings) => {
			this.rules = this.extractRules(settings);
			this.compiledFunctions.clear();
			this.propertyMapping.clear();
		});
	}

	protected abstract extractRules(settings: TSettings): TRule[];

	destroy(): void {
		this.subscription?.unsubscribe();
		this.compiledFunctions.clear();
		this.propertyMapping.clear();
	}

	protected evaluateRule(rule: TRule, frontmatter: Record<string, unknown>): boolean {
		if (!rule.enabled || !rule.expression) {
			return false;
		}

		try {
			// Progressively build property mapping as we encounter new properties
			const currentKeys = new Set(Object.keys(frontmatter));
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
