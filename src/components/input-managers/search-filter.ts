import { cls } from "@real1ty-obsidian-plugins/utils";
import { InputFilterManager } from "./base";

export class SearchFilterInputManager extends InputFilterManager {
	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Search events...", cls("fc-search-input"));
	}

	shouldInclude(event: { title: string }): boolean {
		if (!this.currentFilterValue) return true;
		const searchTerm = this.currentFilterValue.toLowerCase();
		return event.title.toLowerCase().includes(searchTerm);
	}
}
