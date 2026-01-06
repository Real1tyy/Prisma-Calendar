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

	protected getFilterLines(): string[] {
		const dateProp = this.settings.dateProp;
		return [`${dateProp} > "${this.startDate}"`, `${dateProp} < "${this.endDate}"`];
	}
}
