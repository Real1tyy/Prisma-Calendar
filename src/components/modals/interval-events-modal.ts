import { type BaseFilterNode, Filter } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { SingleCalendarConfig } from "../../types/settings";
import { BaseBasesViewModal } from "./base-bases-view-modal";

export class IntervalEventsModal extends BaseBasesViewModal {
	constructor(
		app: App,
		private intervalLabel: string,
		private startDate: string,
		private endDate: string,
		settings: SingleCalendarConfig
	) {
		super(app, settings);
	}

	protected getTitle(): string {
		return `Events: ${this.intervalLabel}`;
	}

	protected getViewName(): string {
		return this.intervalLabel;
	}

	protected getFilters(): BaseFilterNode[] {
		const sortProp = this.settings.sortDateProp;
		return [Filter.gt(sortProp, this.startDate), Filter.lt(sortProp, this.endDate)];
	}
}
