import { cls } from "@real1ty-obsidian-plugins";
import { nanoid } from "nanoid";
import { type App, Modal, Notice, Setting, requestUrl } from "obsidian";
import { ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import type { ICSSubscription } from "../../../core/integrations/ics-subscription";
import { parseICSContent } from "../../../core/integrations/ics-import";
import { COMMON_TIMEZONES } from "../../../core/integrations/ics-export";
import type { SettingsStore } from "../../../core/settings-store";

export class AddICSSubscriptionModal extends Modal {
	private name = "";
	private url = "";
	private syncIntervalMinutes: number = ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES;
	private timezone: string = "UTC";
	private testPassed = false;
	private icon = "";

	constructor(
		app: App,
		private settingsStore: SettingsStore,
		private calendarId: string,
		private onSave: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("caldav-modal"));

		contentEl.createEl("h2", { text: "Add ICS subscription" });

		const formContainer = contentEl.createDiv(cls("caldav-form"));

		new Setting(formContainer)
			.setName("Subscription name")
			.setDesc("Display name for this subscription")
			.addText((text) => {
				text
					.setPlaceholder("My calendar")
					.setValue(this.name)
					.onChange((value) => {
						this.name = value;
					});
			});

		new Setting(formContainer)
			.setName("ICS URL")
			.setDesc("Public URL to an .ics calendar file")
			.addText((text) => {
				text
					.setPlaceholder("https://example.com/calendar.ics")
					.setValue(this.url)
					.onChange((value) => {
						this.url = value;
						this.testPassed = false;
					});
			});

		new Setting(formContainer)
			.setName("Sync interval (minutes)")
			.setDesc("How often to automatically sync (1-1440 minutes)")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.max = "1440";
				text.inputEl.step = "1";
				text.setValue(this.syncIntervalMinutes.toString());
				text.onChange((value) => {
					const numValue = parseInt(value, 10);
					if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 1440) {
						this.syncIntervalMinutes = numValue;
					}
				});
			});

		new Setting(formContainer)
			.setName("Timezone")
			.setDesc("Timezone for event times. If it matches your calendar events, times are preserved as-is.")
			.addDropdown((dropdown) => {
				for (const tz of COMMON_TIMEZONES) {
					dropdown.addOption(tz.id, tz.label);
				}
				dropdown.setValue(this.timezone);
				dropdown.onChange((value) => {
					this.timezone = value;
				});
			});

		new Setting(formContainer)
			.setName("Calendar icon")
			.setDesc("Optional icon/emoji to display on synced events (e.g., 📅, 🔄, ☁️)")
			.addText((text) => {
				text
					.setPlaceholder("📅")
					.setValue(this.icon)
					.onChange((value) => {
						this.icon = value;
					});
			});

		const testButton = formContainer.createEl("button", {
			text: "Test URL",
			cls: cls("caldav-test-button"),
		});
		testButton.addEventListener("click", () => {
			void this.testUrl(testButton);
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => this.close());
			})
			.addButton((button) => {
				button
					.setButtonText("Add subscription")
					.setCta()
					.onClick(() => void this.saveSubscription());
			});
	}

	private async testUrl(button: HTMLButtonElement): Promise<void> {
		if (!this.url) {
			new Notice("Please enter an ICS URL");
			return;
		}

		button.disabled = true;
		button.setText("Testing...");

		try {
			const response = await requestUrl({
				url: this.url,
				method: "GET",
			});

			const parsed = parseICSContent(response.text);

			if (parsed.success) {
				this.testPassed = true;
				new Notice(`Found ${parsed.events.length} event(s)`);
			} else {
				new Notice(`Failed to parse ICS: ${parsed.error?.message || "Unknown error"}`);
				this.testPassed = false;
			}
		} catch (error) {
			new Notice(`Failed to fetch URL: ${error}`);
			this.testPassed = false;
		} finally {
			button.disabled = false;
			button.setText("Test URL");
		}
	}

	private async saveSubscription(): Promise<void> {
		if (!this.name || !this.url) {
			new Notice("Please fill in name and URL");
			return;
		}

		if (!this.testPassed) {
			new Notice("Please test the URL first");
			return;
		}

		const subscription: ICSSubscription = {
			id: nanoid(),
			name: this.name,
			url: this.url,
			enabled: true,
			calendarId: this.calendarId,
			syncIntervalMinutes: this.syncIntervalMinutes,
			timezone: this.timezone,
			createdAt: Date.now(),
			icon: this.icon || undefined,
		};

		await this.settingsStore.updateSettings((s) => ({
			...s,
			icsSubscriptions: {
				...s.icsSubscriptions,
				subscriptions: [...s.icsSubscriptions.subscriptions, subscription],
			},
		}));

		new Notice(`Added subscription: ${this.name}`);
		this.onSave();
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
