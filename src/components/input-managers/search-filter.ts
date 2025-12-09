import { cls } from "@real1ty-obsidian-plugins/utils";
import type { Frontmatter } from "../../types";
import { InputFilterManager } from "./base";

export class SearchFilterInputManager extends InputFilterManager {
	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Search events...", cls("fc-search-input"));
	}

	shouldInclude(data: { meta?: Frontmatter; title?: string }): boolean {
		if (!this.currentFilterValue) return true;
		const searchTerm = this.currentFilterValue.toLowerCase();
		const title = (data.title || (data.meta?.title as string) || "").toLowerCase();
		return title.includes(searchTerm);
	}
}
