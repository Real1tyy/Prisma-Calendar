import { buildPropertyMapping, sanitizeExpression } from "../utils/expression-utils";
import { InputFilterManager } from "./input-filter-manager";

export class ExpressionFilterManager extends InputFilterManager {
	private compiledFunc: ((...args: any[]) => boolean) | null = null;
	private propertyMapping = new Map<string, string>();

	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Status === 'Done'", "fc-expression-input", 50);
	}

	protected updateFilterValue(filterValue: string): void {
		super.updateFilterValue(filterValue);
		this.compiledFunc = null;
		this.propertyMapping.clear();
	}

	shouldInclude(event: { meta?: Record<string, any> }): boolean {
		if (!this.currentFilterValue) return true;

		const frontmatter = event.meta || {};

		try {
			if (this.propertyMapping.size === 0) {
				this.propertyMapping = buildPropertyMapping(Object.keys(frontmatter));
			}

			if (!this.compiledFunc) {
				const sanitized = sanitizeExpression(this.currentFilterValue, this.propertyMapping);
				const params = Array.from(this.propertyMapping.values());
				this.compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (
					...args: any[]
				) => boolean;
			}

			const values = Array.from(this.propertyMapping.keys()).map((key) => frontmatter[key]);
			return this.compiledFunc(...values);
		} catch (error) {
			console.warn("Invalid filter expression:", this.currentFilterValue, error);
			return true;
		}
	}
}
