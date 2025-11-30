import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";

export class CalendarSelectModal extends Modal {
	private onSelect: (bundle: CalendarBundle) => void;
	private calendars: CalendarBundle[];

	constructor(app: App, calendars: CalendarBundle[], onSelect: (bundle: CalendarBundle) => void) {
		super(app);
		this.calendars = calendars;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("calendar-select-modal"));

		contentEl.createEl("h2", { text: "Select calendar to export" });

		const listEl = contentEl.createDiv({ cls: cls("calendar-select-list") });

		for (const bundle of this.calendars) {
			const calendarName = bundle.settingsStore.currentSettings.name;
			const eventCount = bundle.eventStore.getAllEvents().length;

			const itemEl = listEl.createDiv({ cls: cls("calendar-select-item") });

			const nameEl = itemEl.createDiv({ cls: cls("calendar-select-name") });
			nameEl.setText(calendarName);

			const countEl = itemEl.createDiv({ cls: cls("calendar-select-count") });
			countEl.setText(`${eventCount} events`);

			itemEl.addEventListener("click", () => {
				this.onSelect(bundle);
				this.close();
			});
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
