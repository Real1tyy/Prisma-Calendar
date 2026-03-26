import { cls } from "@real1ty-obsidian-plugins";

import type { Frontmatter } from "../../types";
import { matchesSearch } from "../../utils/filter-logic";
import { InputFilterManager } from "./base";

export class SearchFilterInputManager extends InputFilterManager {
	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Search events...", cls("fc-search-input"));
	}

	shouldInclude(data: { meta?: Frontmatter; title?: string }): boolean {
		return matchesSearch(this.currentFilterValue, data);
	}
}
