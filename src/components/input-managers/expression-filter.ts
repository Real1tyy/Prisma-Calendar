import { cls } from "@real1ty-obsidian-plugins/utils";
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
		this.lastWarnedExpression = null; // Clear warning tracker on filter change
	}

	shouldInclude(event: { meta?: Record<string, unknown> }): boolean {
		if (!this.currentFilterValue) return true;

		const frontmatter = event.meta || {};

		try {
			if (this.propertyMapping.size === 0) {
				this.propertyMapping = buildPropertyMapping(Object.keys(frontmatter));
			}

			if (!this.compiledFunc) {
				const sanitized = sanitizeExpression(this.currentFilterValue, this.propertyMapping);
				const params = Array.from(this.propertyMapping.values());
				// eslint-disable-next-line @typescript-eslint/no-implied-eval
				this.compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (
					...args: unknown[]
				) => boolean;
			}

			const values = Array.from(this.propertyMapping.keys()).map((key) => frontmatter[key]);
			return this.compiledFunc(...values);
		} catch (error) {
			// Only warn once per unique expression to avoid console spam
			if (this.lastWarnedExpression !== this.currentFilterValue) {
				console.warn("Invalid filter expression:", this.currentFilterValue, error);
				this.lastWarnedExpression = this.currentFilterValue;
			}
			return true;
		}
	}
}
