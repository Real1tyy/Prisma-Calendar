import { Subject, takeUntil, type BehaviorSubject } from "rxjs";

import { buildPropertyMapping, extractExpressionIdentifiers, sanitizeExpression } from "../../utils/expression-utils";
import { evaluateSafeAst, parseSafeExpression, type SafeExpressionNode } from "./safe-expression";

export interface BaseRule {
	id: string;
	expression: string;
	enabled: boolean;
}

/**
 * Generic base class for evaluating frontmatter predicate expressions against frontmatter
 * objects. Rules come from persisted (and therefore untrusted) settings, so expressions are
 * parsed into a safe AST and interpreted — never compiled with `new Function` — see
 * {@link parseSafeExpression}. Compilation is reactive via an RxJS settings subscription.
 */
export abstract class BaseEvaluator<TRule extends BaseRule, TSettings> {
	protected rules: TRule[] = [];
	private compiledExpressions = new Map<string, SafeExpressionNode>();
	private expressionIdCache = new Map<string, string[]>();
	private propertyMapping = new Map<string, string>();
	private readonly destroy$ = new Subject<void>();

	constructor(settingsStore: BehaviorSubject<TSettings>) {
		settingsStore.pipe(takeUntil(this.destroy$)).subscribe((settings) => {
			this.rules = this.extractRules(settings);
			this.compiledExpressions.clear();
			this.expressionIdCache.clear();
			this.propertyMapping.clear();
		});
	}

	protected abstract extractRules(settings: TSettings): TRule[];

	destroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this.compiledExpressions.clear();
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

			// If new properties are found, rebuild the mapping and invalidate cached ASTs
			// (the sanitised expression depends on the property mapping).
			if (newKeys.length > 0) {
				const allKeys = new Set([...existingKeys, ...currentKeys]);
				this.propertyMapping = buildPropertyMapping(Array.from(allKeys));
				this.compiledExpressions.clear();
			}

			let ast = this.compiledExpressions.get(rule.id);

			if (!ast) {
				const sanitized = sanitizeExpression(rule.expression, this.propertyMapping);
				ast = parseSafeExpression(sanitized);
				this.compiledExpressions.set(rule.id, ast);
			}

			const scope = new Map<string, unknown>();
			for (const [original, mapped] of this.propertyMapping) {
				scope.set(mapped, frontmatter[original] ?? undefined);
			}

			return Boolean(evaluateSafeAst(ast, scope));
		} catch (error) {
			// Malformed or disallowed expressions fail closed (no match). Missing properties are
			// already handled as `undefined` by the interpreter and do not throw.
			console.warn(`Invalid expression (${rule.id}):`, rule.expression, error);
			return false;
		}
	}

	protected isTruthy(value: unknown): boolean {
		return value === true;
	}
}
