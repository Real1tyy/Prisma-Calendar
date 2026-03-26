import { cls } from "@real1ty-obsidian-plugins";

import type { Frontmatter } from "../../types";
import { createExpressionMatcher, type ExpressionMatcher } from "../../utils/filter-logic";
import { InputFilterManager } from "./base";

export class ExpressionFilterInputManager extends InputFilterManager {
	private matcher: ExpressionMatcher;

	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Status === 'Done'", cls("fc-expression-input"), 50);
		this.matcher = createExpressionMatcher(() => this.currentFilterValue);
	}

	protected override updateFilterValue(filterValue: string): void {
		super.updateFilterValue(filterValue);
		this.matcher.invalidate();
	}

	shouldInclude(event: { meta?: Frontmatter }): boolean {
		return this.matcher.evaluate(event.meta || {});
	}
}
