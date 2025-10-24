import { InputFilterManager } from "./input-filter-manager";

export class SearchFilterManager extends InputFilterManager {
	constructor(onFilterChange: () => void) {
		super(onFilterChange, "Search events...", "fc-search-input");
	}

	shouldInclude(event: { title: string }): boolean {
		if (!this.currentFilterValue) return true;
		const searchTerm = this.currentFilterValue.toLowerCase();
		return event.title.toLowerCase().includes(searchTerm);
	}
}
