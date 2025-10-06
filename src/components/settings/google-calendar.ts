import { Setting } from "obsidian";
import type { CalendarSettingsStore } from "../../core/settings-store";

export class GoogleCalendarSettings {
	constructor(private settingsStore: CalendarSettingsStore) {}

	display(containerEl: HTMLElement): void {
		this.addGoogleCalendarSettings(containerEl);
	}

	private addGoogleCalendarSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Google Calendar Integration").setHeading();

		new Setting(containerEl)
			.setName("Enable Google Calendar")
			.setDesc("Automatically sync events from Google Calendar to Obsidian notes")
			.addToggle((toggle) =>
				toggle.setValue(settings.enableGoogleCalendar).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						enableGoogleCalendar: value,
					}));
				})
			);

		new Setting(containerEl).setName("Google Calendar iCal URLs").setHeading();

		new Setting(containerEl)
			.setName("iCal Feed URLs")
			.setDesc(
				"📋 How to get your Secret iCal URL:\n" +
					"1. Open Google Calendar → Settings\n" +
					"2. Select your calendar from the left sidebar\n" +
					"3. Scroll to 'Integrate calendar' section\n" +
					"4. Copy the 'Secret address in iCal format' URL\n" +
					"5. Paste it here (one URL per line)\n\n" +
					"✅ Works with PRIVATE calendars (no need to make them public!)\n" +
					"🔒 The URL contains a secret token - keep it private!"
			)
			.addTextArea((text) => {
				text.setValue(settings.googleCalendarIcalUrls.join("\n"));
				text.setPlaceholder(
					"https://calendar.google.com/calendar/ical/your-email%40gmail.com/private-abc123/basic.ics\nhttps://calendar.google.com/calendar/ical/another-calendar/private-xyz456/basic.ics"
				);
				text.inputEl.style.minHeight = "100px";
				text.onChange(async (value) => {
					const urls = value
						.split("\n")
						.map((url) => url.trim())
						.filter((url) => url.length > 0);

					await this.settingsStore.updateSettings((s) => ({
						...s,
						googleCalendarIcalUrls: urls,
					}));
				});
			});

		new Setting(containerEl)
			.setName("How it works")
			.setDesc(
				"When enabled, events from your Google Calendars will be automatically imported as Obsidian notes. " +
					"Each Google Calendar event will create a physical note in your calendar directory with the googleId stored in frontmatter. " +
					"This is a one-way sync: Google → Obsidian only. Changes to the Obsidian notes will not sync back to Google Calendar."
			);
	}
}
