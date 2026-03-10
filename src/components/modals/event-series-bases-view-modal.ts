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

	protected getViewType(): string {
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

	protected getFilterLines(): string[] {
		const escaped = this.config.filterValue.replace(/"/g, '\\"');
		const rruleProp = this.settings.rruleIdProp;
		const titleProp = this.settings.calendarTitleProp;
		const categoryProp = this.settings.categoryProp;

		switch (this.config.mode) {
			case "recurring":
				return [`'note["${rruleProp}"] == "${escaped}"'`];
			case "name":
				return [`'note["${titleProp}"].contains("${escaped}")'`];
			case "category":
				return [`'note["${categoryProp}"].contains("${escaped}")'`];
		}
	}
}
