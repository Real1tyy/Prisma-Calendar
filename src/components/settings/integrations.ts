import { buildUtmUrl, cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { type App, Setting } from "obsidian";
import type { Subscription } from "rxjs";

import { COMMAND_IDS, DEFAULT_EXPORT_FOLDER } from "../../constants";
import { PRO_FEATURES } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { PrismaCalendarSettingsStore } from "../../types";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { CalDAVSettings } from "./caldav";
import { ICSSubscriptionSettings } from "./ics-subscriptions";
import { renderProUpgradeBanner } from "./pro-upgrade-banner";

const S = SingleCalendarConfigSchema.shape;

export class IntegrationsSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;
	private settingsSubscription: Subscription | null = null;
	private holidayDetailsContainer: HTMLElement | null = null;

	constructor(
		private settingsStore: CalendarSettingsStore,
		private app: App,
		private plugin: CustomCalendarPlugin,
		private mainSettingsStore: PrismaCalendarSettingsStore
	) {
		this.ui = new SettingsUIBuilder(this.settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.holidayDetailsContainer = null;

		this.addIntegrationsSettings(containerEl);
		this.addCalDAVSettings(containerEl);
		this.addICSSubscriptionSettings(containerEl);
		this.addHolidaySettings(containerEl);

		this.settingsSubscription = this.settingsStore.settings$.subscribe(() => {
			if (this.holidayDetailsContainer) {
				this.renderHolidayDetails(this.holidayDetailsContainer);
			}
		});
	}

	private addIntegrationsSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Integrations").setHeading();

		const descContainer = containerEl.createDiv(cls("settings-integrations-desc"));

		descContainer
			.createEl("p")
			.setText("Export and import events using the .ics format, compatible with most calendar apps.");

		descContainer
			.createEl("a", {
				href: buildUtmUrl(
					"https://real1tyy.github.io/Prisma-Calendar/features/integrations",
					"prisma-calendar",
					"plugin",
					"settings",
					"integrations_docs"
				),
				cls: cls("settings-docs-link"),
				attr: { target: "_blank" },
			})
			.setText("Documentation");

		this.ui.addSchemaField(containerEl, { exportFolder: S.exportFolder }, { placeholder: DEFAULT_EXPORT_FOLDER });

		const buttonsContainer = containerEl.createDiv(cls("settings-integrations-buttons"));

		const exportButton = buttonsContainer.createEl("button", {
			cls: cls("settings-integration-button"),
		});
		exportButton.setText("Export calendar");
		exportButton.addEventListener("click", () => {
			(
				this.app as unknown as {
					commands: { executeCommandById: (id: string) => void };
				}
			).commands.executeCommandById(`prisma-calendar:${COMMAND_IDS.EXPORT_CALENDAR_ICS}`);
		});

		const importButton = buttonsContainer.createEl("button", {
			cls: cls("settings-integration-button"),
		});
		importButton.setText("Import .ics");
		importButton.addEventListener("click", () => {
			(
				this.app as unknown as {
					commands: { executeCommandById: (id: string) => void };
				}
			).commands.executeCommandById(`prisma-calendar:${COMMAND_IDS.IMPORT_CALENDAR_ICS}`);
		});
	}

	private addCalDAVSettings(containerEl: HTMLElement): void {
		if (!this.plugin.isProEnabled) {
			renderProUpgradeBanner(
				containerEl,
				PRO_FEATURES.CALDAV_SYNC,
				"Sync events with CalDAV servers like Nextcloud, Radicale, Baikal, and other self-hosted solutions.",
				"CALDAV_SYNC"
			);
			return;
		}
		const calendarId = this.settingsStore.calendarId;
		const caldavSettings = new CalDAVSettings(this.app, this.mainSettingsStore, this.plugin, calendarId);
		caldavSettings.display(containerEl);
	}

	private addICSSubscriptionSettings(containerEl: HTMLElement): void {
		if (!this.plugin.isProEnabled) {
			renderProUpgradeBanner(
				containerEl,
				PRO_FEATURES.ICS_SYNC,
				"Subscribe to ICS calendar URLs from Google Calendar, Outlook, Apple Calendar, and other providers to sync events automatically.",
				"ICS_SYNC"
			);
			return;
		}
		const calendarId = this.settingsStore.calendarId;
		const icsSubSettings = new ICSSubscriptionSettings(this.app, this.mainSettingsStore, this.plugin, calendarId);
		icsSubSettings.display(containerEl);
	}

	private addHolidaySettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Holidays").setHeading();

		this.ui.addToggle(containerEl, {
			key: "holidays.enabled",
			name: "Enable holidays",
			desc: "Display public holidays as virtual read-only events",
		});

		this.holidayDetailsContainer = containerEl.createDiv();
		this.renderHolidayDetails(this.holidayDetailsContainer);
	}

	private renderHolidayDetails(containerEl: HTMLElement): void {
		containerEl.empty();

		const settings = this.settingsStore.currentSettings;

		if (!settings.holidays.enabled) {
			return;
		}

		this.ui.addText(containerEl, {
			key: "holidays.country",
			name: "Country",
			desc: "ISO country code (e.g., US, GB, DE, CA)",
			placeholder: "US",
		});

		this.ui.addText(containerEl, {
			key: "holidays.state",
			name: "State/Province",
			desc: "Optional: State or province code (e.g., ca for California, ny for New York)",
			placeholder: "Optional",
		});

		this.ui.addText(containerEl, {
			key: "holidays.region",
			name: "Region",
			desc: "Optional: Region code for more specific holidays",
			placeholder: "Optional",
		});

		new Setting(containerEl)
			.setName("Holiday types")
			.setDesc("Select which types of holidays to display")
			.addDropdown((dropdown) => {
				dropdown.addOption("public", "Public holidays only");
				dropdown.addOption("public,bank", "Public + Bank holidays");
				dropdown.addOption("public,bank,observance", "Public + Bank + Observance");
				dropdown.addOption("public,bank,observance,school", "All except optional");
				dropdown.addOption("public,bank,observance,school,optional", "All types");

				const currentTypes = settings.holidays.types.join(",");
				dropdown.setValue(currentTypes);

				dropdown.onChange(async (value) => {
					const types = value.split(",") as Array<"public" | "bank" | "school" | "observance" | "optional">;
					await this.settingsStore.updateSettings((s) => ({
						...s,
						holidays: { ...s.holidays, types },
					}));
				});
			});

		this.ui.addText(containerEl, {
			key: "holidays.timezone",
			name: "Timezone",
			desc: "Optional: Timezone for holiday calculations (e.g., America/New_York). Leave empty to use system timezone.",
			placeholder: "Optional",
		});

		const infoDiv = containerEl.createDiv("setting-item-description");
		infoDiv.style.marginTop = "10px";
		infoDiv.innerHTML = `
			<strong>Examples:</strong>
			<ul style="margin: 5px 0; padding-left: 20px;">
				<li><strong>United States:</strong> Country: <code>US</code>, State: <code>ca</code> (California)</li>
				<li><strong>United Kingdom:</strong> Country: <code>GB</code></li>
				<li><strong>Germany:</strong> Country: <code>DE</code>, State: <code>by</code> (Bavaria)</li>
				<li><strong>Canada:</strong> Country: <code>CA</code>, State: <code>on</code> (Ontario)</li>
			</ul>
			<p style="margin: 5px 0;"><em>Note: Holidays are cached per year and refresh automatically when settings change.</em></p>
		`;
	}
}
