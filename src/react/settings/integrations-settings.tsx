import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import {
	Dropdown,
	SchemaSection,
	SettingHeading,
	SettingItem,
	TextInput,
	Toggle,
	useApp,
	useSettingsStore,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import { showCalendarIntegrationDeleteEventsModal } from "../../components/modals";
import { showAddCalDAVAccountModal } from "../../components/settings/caldav/add-modal";
import { showEditCalDAVAccountModal } from "../../components/settings/caldav/edit-modal";
import { showConfirmDeleteModal } from "../../components/settings/generic";
import { showAddICSSubscriptionModal } from "../../components/settings/ics-subscriptions/add-modal";
import { showEditICSSubscriptionModal } from "../../components/settings/ics-subscriptions/edit-modal";
import { deleteTrackedIntegrationEvents } from "../../components/settings/integration-shared";
import { COMMAND_IDS } from "../../constants";
import { PRO_FEATURES } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { PrismaCalendarSettingsStore } from "../../types";
import type { CalDAVAccount, ICSSubscription } from "../../types/integrations";
import { CalDAVSettingsSchema, ICSSubscriptionSettingsSchema } from "../../types/integrations";
import { SingleCalendarConfigSchema } from "../../types/settings";
import { getCalendarById } from "../../utils/calendar-settings";
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
		(app as any).commands.executeCommandById(`prisma-calendar:${COMMAND_IDS.EXPORT_CALENDAR_ICS}`);
	}, [app]);

	const handleImport = useCallback(() => {
		(app as any).commands.executeCommandById(`prisma-calendar:${COMMAND_IDS.IMPORT_CALENDAR_ICS}`);
	}, [app]);

	return (
		<>
			<SettingHeading name="Integrations" />
			<div className="prisma-settings-integrations-desc">
				<p>Export and import events using the .ics format, compatible with most calendar apps.</p>
				<a
					href={buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/configuration/integrations",
						"prisma-calendar",
						"plugin",
						"settings",
						"integrations_docs"
					)}
					className="prisma-settings-docs-link"
					target="_blank"
					rel="noopener"
				>
					Documentation
				</a>
			</div>

			<SchemaSection store={settingsStore} shape={{ exportFolder: S.exportFolder }} testIdPrefix="prisma-settings-" />

			<div className="prisma-settings-integrations-buttons">
				<button type="button" className="prisma-settings-integration-button" onClick={handleExport}>
					Export calendar
				</button>
				<button type="button" className="prisma-settings-integration-button" onClick={handleImport}>
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
	const [mainSettings, updateMainSettings] = useSettingsStore(mainSettingsStore);
	const [, forceUpdate] = useState(0);

	if (!plugin.isProEnabled) {
		return (
			<ProUpgradeBanner
				featureName={PRO_FEATURES.CALDAV_SYNC}
				description="Sync events with CalDAV servers like Nextcloud, Radicale, Baikal, and other self-hosted solutions."
				previewKey="CALDAV_SYNC"
			/>
		);
	}

	const caldavSettings = mainSettings.caldav;
	const accounts = caldavSettings.accounts;

	const handleAddAccount = useCallback(() => {
		showAddCalDAVAccountModal(app, mainSettingsStore, calendarId, () => forceUpdate((n) => n + 1));
	}, [app, mainSettingsStore, calendarId]);

	const handleSync = useCallback(
		async (account: CalDAVAccount) => {
			await plugin.syncSingleAccount(account);
		},
		[plugin]
	);

	const handleEdit = useCallback(
		(account: CalDAVAccount) => {
			showEditCalDAVAccountModal(app, mainSettingsStore, plugin, calendarId, account, () => forceUpdate((n) => n + 1));
		},
		[app, mainSettingsStore, plugin, calendarId]
	);

	const handleDelete = useCallback(
		(account: CalDAVAccount) => {
			const bundle = plugin.calendarBundles.find((b) => b.calendarId === account.calendarId);
			if (!bundle) {
				showConfirmDeleteModal(app, account.name, "account", () => {
					void updateMainSettings((s) => ({
						...s,
						caldav: { ...s.caldav, accounts: s.caldav.accounts.filter((a) => a.id !== account.id) },
					}));
				});
				return;
			}

			const events = bundle.caldavSyncStateManager.getAllForAccount(account.id);
			if (events.length === 0) {
				showConfirmDeleteModal(app, account.name, "account", () => {
					void updateMainSettings((s) => ({
						...s,
						caldav: { ...s.caldav, accounts: s.caldav.accounts.filter((a) => a.id !== account.id) },
					}));
				});
				return;
			}

			showCalendarIntegrationDeleteEventsModal(app, {
				accountName: account.name,
				eventCount: events.length,
				onConfirm: async () => {
					await deleteTrackedIntegrationEvents(
						app,
						bundle,
						events,
						getCalendarById(mainSettingsStore.currentSettings, calendarId)?.fileConcurrencyLimit,
						"CalDAV",
						`account ${account.id}`
					);
					await updateMainSettings((s) => ({
						...s,
						caldav: { ...s.caldav, accounts: s.caldav.accounts.filter((a) => a.id !== account.id) },
					}));
				},
				onCancel: async () => {
					await updateMainSettings((s) => ({
						...s,
						caldav: { ...s.caldav, accounts: s.caldav.accounts.filter((a) => a.id !== account.id) },
					}));
				},
			});
		},
		[app, plugin, mainSettingsStore, calendarId, updateMainSettings]
	);

	return (
		<>
			<SettingHeading name="Calendar sync (read-only)" />
			<div className="prisma-settings-caldav-desc">
				<p>Sync events from external calendar servers.</p>
				<p className="prisma-settings-muted">Events are synced one-way from the server.</p>
			</div>

			<div className="prisma-caldav-accounts-wrapper">
				<div className="prisma-caldav-accounts-container">
					{accounts.length === 0 ? (
						<div className="prisma-caldav-accounts-empty">No accounts configured.</div>
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
				<button type="button" className="prisma-caldav-add-account-button" onClick={handleAddAccount}>
					Add account
				</button>
			</div>

			<SchemaSection
				store={mainSettingsStore}
				shape={CaldavShape}
				fields={["syncOnStartup", "enableAutoSync", "notifyOnSync", "integrationEventColor"]}
				pathPrefix="caldav"
				testIdPrefix="prisma-settings-"
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
		<div className="prisma-caldav-account-item">
			<div className="prisma-caldav-account-info">
				<div className="prisma-caldav-account-name">{account.name}</div>
				<div className="prisma-caldav-account-url">{account.serverUrl}</div>
				<div
					className={`prisma-caldav-account-status ${account.enabled ? "prisma-caldav-status-enabled" : "prisma-caldav-status-disabled"}`}
				>
					{account.enabled ? "Enabled" : "Disabled"}
				</div>
				{account.selectedCalendars.length > 0 && (
					<div className="prisma-caldav-account-calendars">{account.selectedCalendars.length} calendar(s) selected</div>
				)}
			</div>
			<div className="prisma-caldav-account-controls">
				<button type="button" className="prisma-caldav-account-btn" onClick={handleSync} disabled={syncing}>
					{syncing ? "Syncing..." : "Sync now"}
				</button>
				<button type="button" className="prisma-caldav-account-btn" onClick={() => onEdit(account)}>
					Edit
				</button>
				<button
					type="button"
					className="prisma-caldav-account-btn prisma-caldav-account-btn-delete"
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
	const [mainSettings, updateMainSettings] = useSettingsStore(mainSettingsStore);
	const [, forceUpdate] = useState(0);

	if (!plugin.isProEnabled) {
		return (
			<ProUpgradeBanner
				featureName={PRO_FEATURES.ICS_SYNC}
				description="Subscribe to ICS calendar URLs from Google Calendar, Outlook, Apple Calendar, and other providers to sync events automatically."
				previewKey="ICS_SYNC"
			/>
		);
	}

	const icsSettings = mainSettings.icsSubscriptions;
	const subscriptions = icsSettings.subscriptions;

	const handleAddSubscription = useCallback(() => {
		showAddICSSubscriptionModal(app, mainSettingsStore, calendarId, () => forceUpdate((n) => n + 1));
	}, [app, mainSettingsStore, calendarId]);

	const handleSync = useCallback(
		async (subscription: ICSSubscription) => {
			await plugin.syncSingleICSSubscription(subscription);
		},
		[plugin]
	);

	const handleEdit = useCallback(
		(subscription: ICSSubscription) => {
			showEditICSSubscriptionModal(app, mainSettingsStore, subscription, () => forceUpdate((n) => n + 1));
		},
		[app, mainSettingsStore]
	);

	const handleDelete = useCallback(
		(subscription: ICSSubscription) => {
			const bundle = plugin.calendarBundles.find((b) => b.calendarId === subscription.calendarId);
			if (!bundle) {
				showConfirmDeleteModal(app, subscription.name, "subscription", () => {
					void updateMainSettings((s) => ({
						...s,
						icsSubscriptions: {
							...s.icsSubscriptions,
							subscriptions: s.icsSubscriptions.subscriptions.filter((sub) => sub.id !== subscription.id),
						},
					}));
				});
				return;
			}

			const events = bundle.icsSubscriptionSyncStateManager.getAllForSubscription(subscription.id);
			if (events.length === 0) {
				showConfirmDeleteModal(app, subscription.name, "subscription", () => {
					void updateMainSettings((s) => ({
						...s,
						icsSubscriptions: {
							...s.icsSubscriptions,
							subscriptions: s.icsSubscriptions.subscriptions.filter((sub) => sub.id !== subscription.id),
						},
					}));
				});
				return;
			}

			showCalendarIntegrationDeleteEventsModal(app, {
				accountName: subscription.name,
				eventCount: events.length,
				onConfirm: async () => {
					await deleteTrackedIntegrationEvents(
						app,
						bundle,
						events,
						getCalendarById(mainSettingsStore.currentSettings, calendarId)?.fileConcurrencyLimit,
						"ICS Subscription",
						`subscription ${subscription.id}`
					);
					await updateMainSettings((s) => ({
						...s,
						icsSubscriptions: {
							...s.icsSubscriptions,
							subscriptions: s.icsSubscriptions.subscriptions.filter((sub) => sub.id !== subscription.id),
						},
					}));
				},
				onCancel: async () => {
					await updateMainSettings((s) => ({
						...s,
						icsSubscriptions: {
							...s.icsSubscriptions,
							subscriptions: s.icsSubscriptions.subscriptions.filter((sub) => sub.id !== subscription.id),
						},
					}));
				},
			});
		},
		[app, plugin, mainSettingsStore, calendarId, updateMainSettings]
	);

	return (
		<>
			<SettingHeading name="ICS URL subscriptions (read-only)" />
			<div className="prisma-settings-caldav-desc">
				<p>Subscribe to external calendars via public ICS URLs.</p>
				<p className="prisma-settings-muted">
					Events are synced one-way from the URL. Removed events are deleted locally.
				</p>
			</div>

			<div className="prisma-caldav-accounts-wrapper">
				<div className="prisma-caldav-accounts-container">
					{subscriptions.length === 0 ? (
						<div className="prisma-caldav-accounts-empty">No subscriptions configured.</div>
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
				<button type="button" className="prisma-caldav-add-account-button" onClick={handleAddSubscription}>
					Add subscription
				</button>
			</div>

			<SchemaSection
				store={mainSettingsStore}
				shape={IcsShape}
				fields={["syncOnStartup", "enableAutoSync", "notifyOnSync", "integrationEventColor"]}
				pathPrefix="icsSubscriptions"
				testIdPrefix="prisma-settings-"
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
		<div className="prisma-caldav-account-item">
			<div className="prisma-caldav-account-info">
				<div className="prisma-caldav-account-name">{subscription.name}</div>
				<div className="prisma-caldav-account-url">
					{subscription.urlSecretName ? `Secret: ${subscription.urlSecretName}` : "No URL configured"}
				</div>
				<div
					className={`prisma-caldav-account-status ${subscription.enabled ? "prisma-caldav-status-enabled" : "prisma-caldav-status-disabled"}`}
				>
					{subscription.enabled ? "Enabled" : "Disabled"}
				</div>
			</div>
			<div className="prisma-caldav-account-controls">
				<button type="button" className="prisma-caldav-account-btn" onClick={handleSync} disabled={syncing}>
					{syncing ? "Syncing..." : "Sync now"}
				</button>
				<button type="button" className="prisma-caldav-account-btn" onClick={() => onEdit(subscription)}>
					Edit
				</button>
				<button
					type="button"
					className="prisma-caldav-account-btn prisma-caldav-account-btn-delete"
					onClick={() => onDelete(subscription)}
					data-testid={`prisma-settings-ics-sub-delete-${subscription.id}`}
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

const HolidaySection = memo(function HolidaySection({ settingsStore }: HolidaySectionProps) {
	const [settings, updateSettings] = useSettingsStore(settingsStore);
	const holidays = settings.holidays;

	const handleEnabledChange = useCallback(
		(enabled: boolean) => {
			void updateSettings((s) => ({ ...s, holidays: { ...s.holidays, enabled } }));
		},
		[updateSettings]
	);

	const handleFieldChange = useCallback(
		(field: string, value: string) => {
			void updateSettings((s) => ({ ...s, holidays: { ...s.holidays, [field]: value } }));
		},
		[updateSettings]
	);

	const handleTypesChange = useCallback(
		(value: string) => {
			const types = value.split(",") as Array<"public" | "bank" | "school" | "observance" | "optional">;
			void updateSettings((s) => ({ ...s, holidays: { ...s.holidays, types } }));
		},
		[updateSettings]
	);

	return (
		<>
			<SettingHeading name="Holidays" />
			<SettingItem
				name="Enable holidays"
				description="Display public holidays on the calendar as virtual read-only events"
				testId="prisma-settings-field-holidaysEnabled"
			>
				<Toggle
					value={holidays.enabled}
					onChange={handleEnabledChange}
					testId="prisma-settings-control-holidaysEnabled"
				/>
			</SettingItem>

			{holidays.enabled && (
				<>
					<SettingItem
						name="Country"
						description="ISO country code (e.g., US, GB, DE, CA)"
						testId="prisma-settings-field-holidaysCountry"
					>
						<TextInput
							value={holidays.country}
							placeholder="US"
							onChange={(v) => handleFieldChange("country", v)}
							testId="prisma-settings-control-holidaysCountry"
						/>
					</SettingItem>
					<SettingItem
						name="State/Province"
						description="Optional: State or province code (e.g., ca for California, ny for New York)"
						testId="prisma-settings-field-holidaysState"
					>
						<TextInput
							value={holidays.state ?? ""}
							placeholder="Optional"
							onChange={(v) => handleFieldChange("state", v)}
							testId="prisma-settings-control-holidaysState"
						/>
					</SettingItem>
					<SettingItem
						name="Region"
						description="Optional: Region code for more specific holidays"
						testId="prisma-settings-field-holidaysRegion"
					>
						<TextInput
							value={holidays.region ?? ""}
							placeholder="Optional"
							onChange={(v) => handleFieldChange("region", v)}
							testId="prisma-settings-control-holidaysRegion"
						/>
					</SettingItem>
					<SettingItem
						name="Holiday types"
						description="Select which types of holidays to display"
						testId="prisma-settings-field-holidaysTypes"
					>
						<Dropdown
							value={holidays.types.join(",")}
							options={HOLIDAY_TYPE_OPTIONS}
							onChange={handleTypesChange}
							testId="prisma-settings-control-holidaysTypes"
						/>
					</SettingItem>
					<SettingItem
						name="Timezone"
						description="Optional: Timezone for holiday calculations (e.g., America/New_York). Leave empty to use system timezone."
						testId="prisma-settings-field-holidaysTimezone"
					>
						<TextInput
							value={holidays.timezone ?? ""}
							placeholder="Optional"
							onChange={(v) => handleFieldChange("timezone", v)}
							testId="prisma-settings-control-holidaysTimezone"
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
