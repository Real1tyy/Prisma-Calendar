import type { BehaviorSubject, Subscription } from "rxjs";
import { buildPropertyMapping, sanitizeExpression } from "./expression-utils";

export interface BaseRule {
	id: string;
	expression: string;
	enabled: boolean;
}

export abstract class BaseEvaluator<TRule extends BaseRule, TSettings> {
	protected rules: TRule[] = [];
	private compiledFunctions = new Map<string, ((...args: any[]) => boolean) | null>();
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
			if (this.propertyMapping.size === 0) {
				this.propertyMapping = buildPropertyMapping(Object.keys(frontmatter));
			}

			let compiledFunc = this.compiledFunctions.get(rule.id);

			if (!compiledFunc) {
				const sanitized = sanitizeExpression(rule.expression, this.propertyMapping);
				const params = Array.from(this.propertyMapping.values());
				compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (...args: any[]) => boolean;
				this.compiledFunctions.set(rule.id, compiledFunc);
			}

			const values = Array.from(this.propertyMapping.keys()).map((key) => frontmatter[key]);
			const result = compiledFunc(...values);

			return result === true;
		} catch (error) {
			console.warn(`Invalid expression (${rule.id}):`, rule.expression, error);
			return false;
		}
	}

	protected isTruthy(value: any): boolean {
		return value === true;
	}
}
