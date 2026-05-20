import { buildUtmUrl, executeCommand } from "@real1ty-obsidian-plugins";
import {
	Dropdown,
	SettingHeading,
	SettingItem,
	TextInput,
	Toggle,
	useApp,
	useSchemaField,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import { showConfirmDeleteModal } from "../../components/settings/generic";
import { deleteTrackedIntegrationEvents } from "../../components/settings/integration-shared";
import { cls, COMMAND_IDS, PRISMA_CALENDAR_PLUGIN_ID, tid } from "../../constants";
import { PRO_FEATURES } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { PrismaCalendarSettingsStore } from "../../types";
import {
	CalDAVSettingsSchema,
	ICSSubscriptionSettingsSchema,
	type CalDAVAccount,
	type ICSSubscription,
} from "../../types/integrations";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { getCalendarById } from "../../utils/calendar/settings";
import {
	openCalDAVAddModal,
	openCalDAVEditModal,
	openCalendarIntegrationDeleteEventsModal,
	openICSAddModal,
	openICSEditModal,
} from "../modals";
import { PrismaSection } from "./_section";
import { ProUpgradeBanner } from "./pro-upgrade-banner";

const S = SingleCalendarConfigSchema.shape;
const CaldavShape = CalDAVSettingsSchema.shape;
const IcsShape = ICSSubscriptionSettingsSchema.shape;

interface IntegrationsSettingsProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	mainSettingsStore: PrismaCalendarSettingsStore;
}

export const IntegrationsSettingsReact = memo(function IntegrationsSettingsReact({
	settingsStore,
	plugin,
	mainSettingsStore,
}: IntegrationsSettingsProps) {
	const app = useApp();

	return (
		<>
			<IntegrationsSection settingsStore={settingsStore} app={app} />
			<CalDAVSection
				mainSettingsStore={mainSettingsStore}
				plugin={plugin}
				calendarId={settingsStore.calendarId}
				app={app}
			/>
			<ICSSection
				mainSettingsStore={mainSettingsStore}
				plugin={plugin}
				calendarId={settingsStore.calendarId}
				app={app}
			/>
			<HolidaySection settingsStore={settingsStore} />
		</>
	);
});

// ─── Integrations (Export/Import) ───────────────────────────────────────

interface IntegrationsSectionProps {
	settingsStore: CalendarSettingsStore;
	app: ReturnType<typeof useApp>;
}

const IntegrationsSection = memo(function IntegrationsSection({ settingsStore, app }: IntegrationsSectionProps) {
	const handleExport = useCallback(() => {
		executeCommand(app, `${PRISMA_CALENDAR_PLUGIN_ID}:${COMMAND_IDS.EXPORT_CALENDAR_ICS}`);
	}, [app]);

	const handleImport = useCallback(() => {
		executeCommand(app, `${PRISMA_CALENDAR_PLUGIN_ID}:${COMMAND_IDS.IMPORT_CALENDAR_ICS}`);
	}, [app]);

	return (
		<>
			<SettingHeading name="Integrations" />
			<div className={cls("settings-integrations-desc")}>
				<p>Export and import events using the .ics format, compatible with most calendar apps.</p>
				<a
					href={buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/configuration/integrations",
						"prisma-calendar",
						"plugin",
						"settings",
						"integrations_docs"
					)}
					className={cls("settings-docs-link")}
					target="_blank"
					rel="noopener"
				>
					Documentation
				</a>
			</div>

			<PrismaSection store={settingsStore} shape={{ exportFolder: S.exportFolder }} />

			<div className={cls("settings-integrations-buttons")}>
				<button type="button" className={cls("settings-integration-button")} onClick={handleExport}>
					Export calendar
				</button>
				<button type="button" className={cls("settings-integration-button")} onClick={handleImport}>
					Import .ics
				</button>
			</div>
		</>
	);
});

// ─── CalDAV ─────────────────────────────────────────────────────────────

interface CalDAVSectionProps {
	mainSettingsStore: PrismaCalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	calendarId: string;
	app: ReturnType<typeof useApp>;
}

const CalDAVSection = memo(function CalDAVSection({ mainSettingsStore, plugin, calendarId, app }: CalDAVSectionProps) {
	const [caldavSettings, setCaldav] = useSchemaField(mainSettingsStore, "caldav");

	const handleAddAccount = useCallback(() => {
		void openCalDAVAddModal(app, mainSettingsStore, calendarId);
	}, [app, mainSettingsStore, calendarId]);

	const handleSync = useCallback(
		async (account: CalDAVAccount) => {
			await plugin.syncSingleAccount(account);
		},
		[plugin]
	);

	const handleEdit = useCallback(
		(account: CalDAVAccount) => {
			void openCalDAVEditModal(app, mainSettingsStore, plugin, calendarId, account);
		},
		[app, mainSettingsStore, plugin, calendarId]
	);

	const handleDelete = useCallback(
		(account: CalDAVAccount) => {
			const removeAccount = () =>
				setCaldav((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== account.id) }));

			const bundle = plugin.calendarBundles.find((b) => b.calendarId === account.calendarId);
			if (!bundle) {
				showConfirmDeleteModal(app, account.name, "account", () => {
					removeAccount();
				});
				return;
			}

			const events = bundle.caldavSyncStateManager.getAllForAccount(account.id);
			if (events.length === 0) {
				showConfirmDeleteModal(app, account.name, "account", () => {
					removeAccount();
				});
				return;
			}

			void openCalendarIntegrationDeleteEventsModal(app, {
				accountName: account.name,
				eventCount: events.length,
			}).then(async (result) => {
				if (result === "confirm") {
					await deleteTrackedIntegrationEvents(
						app,
						bundle,
						events,
						getCalendarById(mainSettingsStore.currentSettings, calendarId)?.fileConcurrencyLimit,
						"CalDAV",
						`account ${account.id}`
					);
				}
				if (result === "confirm" || result === "cancel") {
					removeAccount();
				}
			});
		},
		[app, plugin, mainSettingsStore, calendarId, setCaldav]
	);

	if (!plugin.isProEnabled) {
		return (
			<ProUpgradeBanner
				featureName={PRO_FEATURES.CALDAV_SYNC}
				description="Sync events with CalDAV servers like Nextcloud, Radicale, Baikal, and other self-hosted solutions."
				previewKey="CALDAV_SYNC"
			/>
		);
	}

	const accounts = caldavSettings.accounts;

	return (
		<>
			<SettingHeading name="Calendar sync (read-only)" />
			<div className={cls("settings-caldav-desc")}>
				<p>Sync events from external calendar servers.</p>
				<p className={cls("settings-muted")}>Events are synced one-way from the server.</p>
			</div>

			<div className={cls("caldav-accounts-wrapper")}>
				<div className={cls("caldav-accounts-container")}>
					{accounts.length === 0 ? (
						<div className={cls("caldav-accounts-empty")}>No accounts configured.</div>
					) : (
						accounts.map((account) => (
							<CalDAVAccountItem
								key={account.id}
								account={account}
								onSync={handleSync}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))
					)}
				</div>
				<button type="button" className={cls("caldav-add-account-button")} onClick={handleAddAccount}>
					Add account
				</button>
			</div>

			<PrismaSection
				store={mainSettingsStore}
				shape={CaldavShape}
				fields={["syncOnStartup", "enableAutoSync", "notifyOnSync", "integrationEventColor"]}
				pathPrefix="caldav"
			/>
		</>
	);
});

interface CalDAVAccountItemProps {
	account: CalDAVAccount;
	onSync: (account: CalDAVAccount) => Promise<void>;
	onEdit: (account: CalDAVAccount) => void;
	onDelete: (account: CalDAVAccount) => void;
}

const CalDAVAccountItem = memo(function CalDAVAccountItem({
	account,
	onSync,
	onEdit,
	onDelete,
}: CalDAVAccountItemProps) {
	const [syncing, setSyncing] = useState(false);

	const handleSync = useCallback(async () => {
		setSyncing(true);
		try {
			await onSync(account);
		} finally {
			setSyncing(false);
		}
	}, [account, onSync]);

	return (
		<div className={cls("caldav-account-item")}>
			<div className={cls("caldav-account-info")}>
				<div className={cls("caldav-account-name")}>{account.name}</div>
				<div className={cls("caldav-account-url")}>{account.serverUrl}</div>
				<div
					className={cls("caldav-account-status", account.enabled ? "caldav-status-enabled" : "caldav-status-disabled")}
				>
					{account.enabled ? "Enabled" : "Disabled"}
				</div>
				{account.selectedCalendars.length > 0 && (
					<div className={cls("caldav-account-calendars")}>{account.selectedCalendars.length} calendar(s) selected</div>
				)}
			</div>
			<div className={cls("caldav-account-controls")}>
				<button
					type="button"
					className={cls("caldav-account-btn")}
					onClick={() => void handleSync()}
					disabled={syncing}
				>
					{syncing ? "Syncing..." : "Sync now"}
				</button>
				<button type="button" className={cls("caldav-account-btn")} onClick={() => onEdit(account)}>
					Edit
				</button>
				<button
					type="button"
					className={cls("caldav-account-btn", "caldav-account-btn-delete")}
					onClick={() => onDelete(account)}
				>
					Delete
				</button>
			</div>
		</div>
	);
});

// ─── ICS Subscriptions ──────────────────────────────────────────────────

interface ICSSectionProps {
	mainSettingsStore: PrismaCalendarSettingsStore;
	plugin: CustomCalendarPlugin;
	calendarId: string;
	app: ReturnType<typeof useApp>;
}

const ICSSection = memo(function ICSSection({ mainSettingsStore, plugin, calendarId, app }: ICSSectionProps) {
	const [icsSettings, setIcs] = useSchemaField(mainSettingsStore, "icsSubscriptions");

	const handleAddSubscription = useCallback(() => {
		void openICSAddModal(app, mainSettingsStore, calendarId);
	}, [app, mainSettingsStore, calendarId]);

	const handleSync = useCallback(
		async (subscription: ICSSubscription) => {
			await plugin.syncSingleICSSubscription(subscription);
		},
		[plugin]
	);

	const handleEdit = useCallback(
		(subscription: ICSSubscription) => {
			void openICSEditModal(app, mainSettingsStore, subscription);
		},
		[app, mainSettingsStore]
	);

	const handleDelete = useCallback(
		(subscription: ICSSubscription) => {
			const removeSubscription = () =>
				setIcs((prev) => ({
					...prev,
					subscriptions: prev.subscriptions.filter((sub) => sub.id !== subscription.id),
				}));

			const bundle = plugin.calendarBundles.find((b) => b.calendarId === subscription.calendarId);
			const events = bundle?.icsSubscriptionSyncStateManager.getAllForSubscription(subscription.id) ?? [];
			if (!bundle || events.length === 0) {
				showConfirmDeleteModal(app, subscription.name, "subscription", () => {
					removeSubscription();
				});
				return;
			}

			void openCalendarIntegrationDeleteEventsModal(app, {
				accountName: subscription.name,
				eventCount: events.length,
			}).then(async (result) => {
				if (result === "confirm") {
					await deleteTrackedIntegrationEvents(
						app,
						bundle,
						events,
						getCalendarById(mainSettingsStore.currentSettings, calendarId)?.fileConcurrencyLimit,
						"ICS Subscription",
						`subscription ${subscription.id}`
					);
				}
				if (result === "confirm" || result === "cancel") {
					removeSubscription();
				}
			});
		},
		[app, plugin, mainSettingsStore, calendarId, setIcs]
	);

	if (!plugin.isProEnabled) {
		return (
			<ProUpgradeBanner
				featureName={PRO_FEATURES.ICS_SYNC}
				description="Subscribe to ICS calendar URLs from Google Calendar, Outlook, Apple Calendar, and other providers to sync events automatically."
				previewKey="ICS_SYNC"
			/>
		);
	}

	const subscriptions = icsSettings.subscriptions;

	return (
		<>
			<SettingHeading name="ICS URL subscriptions (read-only)" />
			<div className={cls("settings-caldav-desc")}>
				<p>Subscribe to external calendars via public ICS URLs.</p>
				<p className={cls("settings-muted")}>
					Events are synced one-way from the URL. Removed events are deleted locally.
				</p>
			</div>

			<div className={cls("caldav-accounts-wrapper")}>
				<div className={cls("caldav-accounts-container")}>
					{subscriptions.length === 0 ? (
						<div className={cls("caldav-accounts-empty")}>No subscriptions configured.</div>
					) : (
						subscriptions.map((subscription) => (
							<ICSSubscriptionItem
								key={subscription.id}
								subscription={subscription}
								onSync={handleSync}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))
					)}
				</div>
				<button type="button" className={cls("caldav-add-account-button")} onClick={handleAddSubscription}>
					Add subscription
				</button>
			</div>

			<PrismaSection
				store={mainSettingsStore}
				shape={IcsShape}
				fields={["syncOnStartup", "enableAutoSync", "notifyOnSync", "integrationEventColor"]}
				pathPrefix="icsSubscriptions"
			/>
		</>
	);
});

interface ICSSubscriptionItemProps {
	subscription: ICSSubscription;
	onSync: (subscription: ICSSubscription) => Promise<void>;
	onEdit: (subscription: ICSSubscription) => void;
	onDelete: (subscription: ICSSubscription) => void;
}

const ICSSubscriptionItem = memo(function ICSSubscriptionItem({
	subscription,
	onSync,
	onEdit,
	onDelete,
}: ICSSubscriptionItemProps) {
	const [syncing, setSyncing] = useState(false);

	const handleSync = useCallback(async () => {
		setSyncing(true);
		try {
			await onSync(subscription);
		} finally {
			setSyncing(false);
		}
	}, [subscription, onSync]);

	return (
		<div className={cls("caldav-account-item")}>
			<div className={cls("caldav-account-info")}>
				<div className={cls("caldav-account-name")}>{subscription.name}</div>
				<div className={cls("caldav-account-url")}>
					{subscription.urlSecretName ? `Secret: ${subscription.urlSecretName}` : "No URL configured"}
				</div>
				<div
					className={cls(
						"caldav-account-status",
						subscription.enabled ? "caldav-status-enabled" : "caldav-status-disabled"
					)}
				>
					{subscription.enabled ? "Enabled" : "Disabled"}
				</div>
			</div>
			<div className={cls("caldav-account-controls")}>
				<button
					type="button"
					className={cls("caldav-account-btn")}
					onClick={() => void handleSync()}
					disabled={syncing}
				>
					{syncing ? "Syncing..." : "Sync now"}
				</button>
				<button type="button" className={cls("caldav-account-btn")} onClick={() => onEdit(subscription)}>
					Edit
				</button>
				<button
					type="button"
					className={cls("caldav-account-btn", "caldav-account-btn-delete")}
					onClick={() => onDelete(subscription)}
					data-testid={tid("settings-ics-sub-delete", subscription.id)}
				>
					Delete
				</button>
			</div>
		</div>
	);
});

// ─── Holidays ───────────────────────────────────────────────────────────

interface HolidaySectionProps {
	settingsStore: CalendarSettingsStore;
}

const HOLIDAY_TYPE_OPTIONS: Record<string, string> = {
	public: "Public holidays only",
	"public,bank": "Public + Bank holidays",
	"public,bank,observance": "Public + Bank + Observance",
	"public,bank,observance,school": "All except optional",
	"public,bank,observance,school,optional": "All types",
};

type HolidayStringField = "country" | "state" | "region" | "timezone";

const HolidaySection = memo(function HolidaySection({ settingsStore }: HolidaySectionProps) {
	const [holidays, setHolidays] = useSchemaField(settingsStore, "holidays");

	const handleEnabledChange = useCallback(
		(enabled: boolean) => {
			setHolidays({ ...holidays, enabled });
		},
		[holidays, setHolidays]
	);

	const handleFieldChange = useCallback(
		(field: HolidayStringField, value: string) => {
			setHolidays({ ...holidays, [field]: value });
		},
		[holidays, setHolidays]
	);

	const handleTypesChange = useCallback(
		(value: string) => {
			const types = value.split(",") as Array<"public" | "bank" | "school" | "observance" | "optional">;
			setHolidays({ ...holidays, types });
		},
		[holidays, setHolidays]
	);

	return (
		<>
			<SettingHeading name="Holidays" />
			<SettingItem
				name="Enable holidays"
				description="Display public holidays on the calendar as virtual read-only events"
				testId={tid("settings-field-holidays-enabled")}
			>
				<Toggle
					value={holidays.enabled}
					onChange={handleEnabledChange}
					testId={tid("settings-control-holidays-enabled")}
				/>
			</SettingItem>

			{holidays.enabled && (
				<>
					<SettingItem
						name="Country"
						description="ISO country code (e.g., US, GB, DE, CA)"
						testId={tid("settings-field-holidays-country")}
					>
						<TextInput
							value={holidays.country}
							placeholder="US"
							onChange={(v) => handleFieldChange("country", v)}
							testId={tid("settings-control-holidays-country")}
						/>
					</SettingItem>
					<SettingItem
						name="State/Province"
						description="Optional: State or province code (e.g., ca for California, ny for New York)"
						testId={tid("settings-field-holidays-state")}
					>
						<TextInput
							value={holidays.state ?? ""}
							placeholder="Optional"
							onChange={(v) => handleFieldChange("state", v)}
							testId={tid("settings-control-holidays-state")}
						/>
					</SettingItem>
					<SettingItem
						name="Region"
						description="Optional: Region code for more specific holidays"
						testId={tid("settings-field-holidays-region")}
					>
						<TextInput
							value={holidays.region ?? ""}
							placeholder="Optional"
							onChange={(v) => handleFieldChange("region", v)}
							testId={tid("settings-control-holidays-region")}
						/>
					</SettingItem>
					<SettingItem
						name="Holiday types"
						description="Select which types of holidays to display"
						testId={tid("settings-field-holidays-types")}
					>
						<Dropdown
							value={holidays.types.join(",")}
							options={HOLIDAY_TYPE_OPTIONS}
							onChange={handleTypesChange}
							testId={tid("settings-control-holidays-types")}
						/>
					</SettingItem>
					<SettingItem
						name="Timezone"
						description="Optional: Timezone for holiday calculations (e.g., America/New_York). Leave empty to use system timezone."
						testId={tid("settings-field-holidays-timezone")}
					>
						<TextInput
							value={holidays.timezone ?? ""}
							placeholder="Optional"
							onChange={(v) => handleFieldChange("timezone", v)}
							testId={tid("settings-control-holidays-timezone")}
						/>
					</SettingItem>
					<div className="setting-item-description" style={{ marginTop: 10 }}>
						<strong>Examples:</strong>
						<ul style={{ margin: "5px 0", paddingLeft: 20 }}>
							<li>
								<strong>United States:</strong> Country: <code>US</code>, State: <code>ca</code> (California)
							</li>
							<li>
								<strong>United Kingdom:</strong> Country: <code>GB</code>
							</li>
							<li>
								<strong>Germany:</strong> Country: <code>DE</code>, State: <code>by</code> (Bavaria)
							</li>
							<li>
								<strong>Canada:</strong> Country: <code>CA</code>, State: <code>on</code> (Ontario)
							</li>
						</ul>
						<p style={{ margin: "5px 0" }}>
							<em>Note: Holidays are cached per year and refresh automatically when settings change.</em>
						</p>
					</div>
				</>
			)}
		</>
	);
});
