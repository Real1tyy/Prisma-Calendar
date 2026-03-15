import { type BaseFilterNode, Filter } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { SingleCalendarConfig } from "../../types/settings";
import { BaseBasesViewModal } from "./base-bases-view-modal";

export class CategoryEventsModal extends BaseBasesViewModal {
	constructor(
		app: App,
		private categoryName: string,
		settings: SingleCalendarConfig
	) {
		super(app, settings);
	}

	protected getTitle(): string {
		return `Category: ${this.categoryName}`;
	}

	protected getViewName(): string {
		return this.categoryName;
	}

	protected getFilters(): BaseFilterNode[] {
		return [Filter.contains(this.settings.categoryProp, this.categoryName)];
	}
}
