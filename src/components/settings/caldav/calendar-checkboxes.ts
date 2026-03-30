import { cls } from "@real1ty-obsidian-plugins";

export function renderCalendarCheckboxes(
	container: HTMLElement,
	calendars: Array<{ url: string; displayName: string; description?: string | undefined }>,
	selectedCalendars: string[],
	onSelectionChanged: (selected: string[]) => void
): void {
	let selectorContainer = container.querySelector(`.${cls("caldav-calendar-selector")}`);
	if (selectorContainer) {
		selectorContainer.empty();
	} else {
		selectorContainer = container.createDiv(cls("caldav-calendar-selector"));
	}

	if (calendars.length === 0) {
		selectorContainer.createEl("p", {
			text: "Test connection to discover available calendars",
			cls: cls("settings-muted"),
		});
		return;
	}

	selectorContainer.createEl("h3", { text: "Select calendars to sync" });

	let current = [...selectedCalendars];

	for (const calendar of calendars) {
		const calendarItem = selectorContainer.createDiv(cls("caldav-calendar-item"));

		const checkbox = calendarItem.createEl("input", { type: "checkbox" });
		checkbox.checked = current.includes(calendar.url);
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) {
				current = [...current, calendar.url];
			} else {
				current = current.filter((u) => u !== calendar.url);
			}
			onSelectionChanged(current);
		});

		const label = calendarItem.createEl("label");
		label.createEl("strong", { text: calendar.displayName });
		if (calendar.description) {
			label.createEl("span", {
				text: ` — ${calendar.description}`,
				cls: cls("settings-muted"),
			});
		}
	}
}
