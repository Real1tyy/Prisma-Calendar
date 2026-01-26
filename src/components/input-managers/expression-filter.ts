import { cls } from "@real1ty-obsidian-plugins";
import type { Frontmatter } from "../../types";
import { buildPropertyMapping, sanitizeExpression } from "../../utils/expression-utils";
import { InputFilterManager } from "./base";

export class ExpressionFilterInputManager extends InputFilterManager {
	private compiledFunc: ((...args: unknown[]) => boolean) | null = null;
	private propertyMapping = new Map<string, string>();
	private lastWarnedExpression: string | null = null;

	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Status === 'Done'", cls("fc-expression-input"), 50);
	}

	protected updateFilterValue(filterValue: string): void {
		super.updateFilterValue(filterValue);
		this.compiledFunc = null;
		this.propertyMapping.clear();
		this.lastWarnedExpression = null;
	}

	shouldInclude(event: { meta?: Frontmatter }): boolean {
		if (!this.currentFilterValue) return true;

		const frontmatter = event.meta || {};

		try {
			const currentKeys = new Set(Object.keys(frontmatter));
			const existingKeys = new Set(this.propertyMapping.keys());
			const newKeys = [...currentKeys].filter((key) => !existingKeys.has(key));

			if (newKeys.length > 0) {
				const allKeys = new Set([...existingKeys, ...currentKeys]);
				this.propertyMapping = buildPropertyMapping(Array.from(allKeys));
				this.compiledFunc = null;
			}

			if (!this.compiledFunc) {
				const sanitized = sanitizeExpression(this.currentFilterValue, this.propertyMapping);
				const params = Array.from(this.propertyMapping.values());

				this.compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (
					...args: unknown[]
				) => boolean;
			}

			const values = Array.from(this.propertyMapping.keys()).map((key) => frontmatter[key] ?? undefined);
			const result = this.compiledFunc(...values);

			return result;
		} catch (error) {
			if (error instanceof ReferenceError) {
				const hasInequality = this.currentFilterValue.includes("!==") || this.currentFilterValue.includes("!=");
				return hasInequality;
			}

			if (this.lastWarnedExpression !== this.currentFilterValue) {
				console.warn("Invalid filter expression:", this.currentFilterValue, error);
				this.lastWarnedExpression = this.currentFilterValue;
			}
			return false;
		}
	}
}
