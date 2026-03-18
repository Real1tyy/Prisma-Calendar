import { type BaseFilterNode, type BaseViewType, Filter } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { SingleCalendarConfig } from "../../types/settings";
import { BaseBasesViewModal } from "./base-bases-view-modal";

export interface EventSeriesBasesViewConfig {
	mode: "recurring" | "name" | "category";
	filterValue: string;
	displayTitle?: string;
	viewType: "table" | "cards" | "list";
}

export class EventSeriesBasesViewModal extends BaseBasesViewModal {
	constructor(
		app: App,
		settings: SingleCalendarConfig,
		private config: EventSeriesBasesViewConfig
	) {
		super(app, settings);
	}

	protected override getViewType(): BaseViewType {
		return this.config.viewType;
	}

	protected getTitle(): string {
		const label = this.config.displayTitle ?? this.config.filterValue;
		switch (this.config.mode) {
			case "recurring":
				return `Recurring: ${label}`;
			case "name":
				return `Series: ${label}`;
			case "category":
				return `Category: ${label}`;
		}
	}

	protected getViewName(): string {
		return this.config.displayTitle ?? this.config.filterValue;
	}

	protected getFilters(): BaseFilterNode[] {
		const { filterValue } = this.config;

		switch (this.config.mode) {
			case "recurring":
				return [Filter.eq(this.settings.rruleIdProp, filterValue)];
			case "name":
				return [Filter.contains(this.settings.calendarTitleProp, filterValue)];
			case "category":
				return [Filter.contains(this.settings.categoryProp, filterValue)];
		}
	}
}
