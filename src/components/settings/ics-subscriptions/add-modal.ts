import { cls } from "@real1ty-obsidian-plugins";
import { nanoid } from "nanoid";
import { type App, Modal, Notice, requestUrl } from "obsidian";
import { ICS_SUBSCRIPTION_DEFAULTS } from "../../../constants";
import type { ICSSubscription } from "../../../core/integrations/ics-subscription";
import { parseICSContent } from "../../../core/integrations/ics-import";
import type { SettingsStore } from "../../../core/settings-store";
import {
	renderActionButtons,
	renderNameField,
	renderSyncIntervalField,
	renderTimezoneField,
	renderUrlField,
} from "../generic";

export class AddICSSubscriptionModal extends Modal {
	private name = "";
	private url = "";
	private syncIntervalMinutes: number = ICS_SUBSCRIPTION_DEFAULTS.SYNC_INTERVAL_MINUTES;
	private timezone: string = "UTC";
	private testPassed = false;

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

		renderNameField(formContainer, {
			label: "Subscription name",
			desc: "Display name for this subscription",
			placeholder: "My calendar",
			value: this.name,
			onChange: (value) => {
				this.name = value;
			},
		});

		renderUrlField(formContainer, {
			label: "ICS URL",
			desc: "Public URL to an .ics calendar file",
			placeholder: "https://example.com/calendar.ics",
			value: this.url,
			onChange: (value) => {
				this.url = value;
				this.testPassed = false;
			},
		});

		renderSyncIntervalField(formContainer, {
			value: this.syncIntervalMinutes,
			onChange: (value) => {
				this.syncIntervalMinutes = value;
			},
		});

		renderTimezoneField(formContainer, {
			value: this.timezone,
			onChange: (value) => {
				this.timezone = value;
			},
		});

		const testButton = formContainer.createEl("button", {
			text: "Test URL",
			cls: cls("caldav-test-button"),
		});
		testButton.addEventListener("click", () => {
			void this.testUrl(testButton);
		});

		renderActionButtons(contentEl, {
			cancelFn: () => this.close(),
			saveFn: () => void this.saveSubscription(),
			saveText: "Add subscription",
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
