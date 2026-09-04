import { buildUtmUrl } from "@real1ty/obsidian-plugins";
import {
	Dropdown,
	Button,
	GeneralSection,
	OutboundLink,
	SettingHeading,
	SettingItem,
	showWhatsNewReactModal,
	Toggle,
	useSchemaField,
	useSettingsFields,
} from "@real1ty/obsidian-plugins-react";
import { memo, useCallback, useState } from "react";

import { cls, docsUrl, settingsDocUrl, tid } from "../../constants";
import { LICENSE_SECRET_ID } from "../../core/api/license-activation";
import { ACCOUNT_URL, FREE_MAX_EVENT_PRESETS } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { buildWhatsNewConfig } from "../../core/whats-new-config";
import type CustomCalendarPlugin from "../../main";
import {
	CustomCalendarSettingsSchema,
	SingleCalendarConfigSchema,
} from "../../types/settings";
import { HelpBox } from "./_help-box";
import {
	PRISMA_NON_TRANSFERABLE_SETTINGS,
	PRISMA_SETTINGS_TRANSFER_FILENAME,
} from "../../utils/settings-transfer";
import { PRISMA_SETTINGS_TEST_ID_PREFIX, PrismaSection } from "./_section";
import { PRISMA_HELP_CENTER } from "./help-content";
import { ProUpgradeBanner } from "./pro-upgrade-banner";

const SHAPE = SingleCalendarConfigSchema.shape;
const MAIN_SHAPE = CustomCalendarSettingsSchema.shape;

const GITHUB_ISSUES_URL = "https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose";
const FEEDBACK_URL = "https://matejvavroproductivity.com/feedback";
const PRODUCT_PAGE_URL = "https://matejvavroproductivity.com/tools/prisma-calendar/";
const PRO_PITCH =
	"unlocks external synchronization, advanced visualizations, Bases integration for embedding views directly inside notes, and other power-user capabilities built for serious planning inside Obsidian.";

const PLANNING_FIELDS = ["directory", "templatePath", "indexSubdirectories"];
const INTERFACE_FIELDS = ["locale", "showRibbonIcon", "enableKeyboardNavigation", "autoAssignZettelId"];
const EVENT_DEFAULTS_FIELDS = [
	"defaultDurationMinutes",
	"showDurationField",
	"titleAutocomplete",
	"markPastInstancesAsDone",
];

interface GeneralSettingsProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
}

export const GeneralSettingsReact = memo(function GeneralSettingsReact({
	settingsStore,
	plugin,
}: GeneralSettingsProps) {
	const [licenseKeySecretName, setLicenseKeySecretName] = useSchemaField(plugin.settingsStore, "licenseKeySecretName");

	const onSecretChange = useCallback(
		(value: string) => {
			setLicenseKeySecretName(value);
			return Promise.resolve();
		},
		[setLicenseKeySecretName]
	);

	const handleViewChangelog = useCallback(() => {
		const config = buildWhatsNewConfig(plugin.changelogContent, "settings");
		showWhatsNewReactModal(plugin.app, plugin, config, "0.0.0", plugin.manifest.version);
	}, [plugin]);

	const calendarSection = (heading: string, fields: string[]) => (
		<PrismaSection store={settingsStore} shape={SHAPE} heading={heading} fields={fields} />
	);
	const mainSection = (heading: string, fields: string[]) => (
		<PrismaSection store={plugin.settingsStore} shape={MAIN_SHAPE} heading={heading} fields={fields} />
	);

	return (
		<GeneralSection
			slug="prisma-calendar"
			testIdPrefix={PRISMA_SETTINGS_TEST_ID_PREFIX}
			license={{
				enabled: true,
				licenseManager: plugin.licenseManager,
				currentSecretName: licenseKeySecretName,
				licenseSecretId: LICENSE_SECRET_ID,
				onSecretChange,
				activationGuideUrl: settingsDocUrl("/configuration/license", "license_guide"),
				accountUrls: {
					subscription: buildUtmUrl(ACCOUNT_URL, "prisma-calendar", "plugin", "settings", "manage_subscription"),
					billing: buildUtmUrl(ACCOUNT_URL, "prisma-calendar", "plugin", "settings", "manage_billing"),
					devices: buildUtmUrl(ACCOUNT_URL, "prisma-calendar", "plugin", "settings", "manage_devices"),
				},
			}}
			help={{
				pluginDisplayName: "Prisma",
				documentationUrl: docsUrl(""),
				faqUrl: docsUrl("/faq"),
				troubleshootingUrl: docsUrl("/troubleshooting"),
				githubIssuesUrl: GITHUB_ISSUES_URL,
				feedbackUrl: FEEDBACK_URL,
				helpCenter: PRISMA_HELP_CENTER,
				pro: {
					productName: "Prisma Pro",
					productPageUrl: PRODUCT_PAGE_URL,
					pitch: PRO_PITCH,
				},
			}}
			changelog={{ onView: handleViewChangelog }}
			settingsTransfer={{
				store: plugin.settingsStore,
				defaults: plugin.settingsStore.getDefaults(),
				nonTransferableKeys: PRISMA_NON_TRANSFERABLE_SETTINGS,
				filename: PRISMA_SETTINGS_TRANSFER_FILENAME,
				modalClass: cls("settings-transfer-modal"),
			}}
		>
			{calendarSection("Planning system", PLANNING_FIELDS)}
			<ReadOnlyField plugin={plugin} />
			<MultiDeviceHelp />
			{calendarSection("Interface", INTERFACE_FIELDS)}
			{mainSection("Updates", ["checkForReleaseUpdates"])}
			{calendarSection("Event defaults", EVENT_DEFAULTS_FIELDS)}
			{calendarSection("Time tracker", ["showStopwatch"])}
			{calendarSection("Statistics", ["showDecimalHours", "defaultAggregationMode"])}
			<EventPresetsSection settingsStore={settingsStore} plugin={plugin} />
		</GeneralSection>
	);
});

const ReadOnlyField = memo(function ReadOnlyField({ plugin }: { plugin: CustomCalendarPlugin }) {
	const [readOnly, setReadOnly] = useState(plugin.deviceRoleStore.data.readOnly);
	const [hasSelectedRole, setHasSelectedRole] = useState(plugin.deviceRoleStore.hasSelectedRole);
	const handleChange = useCallback(
		(value: boolean) => {
			setReadOnly(value);
			setHasSelectedRole(true);
			void plugin.deviceRoleStore.updateData({ readOnly: value });
		},
		[plugin]
	);

	return (
		<>
			{!hasSelectedRole && (
				<div className={cls("settings-warning-box")} data-testid={tid("settings-device-role-warning")}>
					<p>
						<strong>Choose this device's role.</strong> Prisma is using safe Reader mode until you explicitly choose.
					</p>
					<Button testId={tid("settings-confirm-reader")} onClick={() => handleChange(true)}>
						Keep Reader
					</Button>
				</div>
			)}
			<SettingItem
				name="Read-only mode"
				description="Reader devices perform none of Prisma's automatic writes: no recurring instances, marking done, Sort Date or Calendar Title normalisation, ZettelID assignment, CalDAV/ICS sync, series propagation, time-tracker saves or reminder flags. Manual actions still work. This choice stays in this browser's local storage and never syncs with the vault."
				testId={tid("settings-field-read-only")}
			>
				<Toggle value={readOnly} onChange={handleChange} testId={tid("settings-control-read-only")} />
			</SettingItem>
		</>
	);
});

const MULTI_DEVICE_DOC_HREF = settingsDocUrl("/features/advanced/multi-device-sync", "general_multi_device");

/**
 * Standing explanation for a vault open on several devices. Lists only what
 * still depends on the device or on timing — never what already converges — so
 * it shrinks as the planned changes land.
 */
const MultiDeviceHelp = memo(function MultiDeviceHelp() {
	return (
		<HelpBox label="Using several devices" slug="multi-device">
			<p>
				Prisma does not coordinate devices that have the same vault open concurrently. Current automatic writes,
				including recurring-event and integration IDs, are designed to converge. Different settings, versions, or
				non-deterministic templates can still produce conflicts. Use these safeguards:
			</p>
			<ul>
				<li>
					<strong>Sync the plugin settings</strong> (<code>data.json</code>) along with your notes. Devices with
					different property names, property order or done values produce different files.
				</li>
				<li>
					<strong>Nominate one Writer</strong> — usually the device where you create most things — and use Reader mode on
					other devices that may be open at the same time.
				</li>
			</ul>
			<p>The risk is substantially reduced when the vault is not open on several devices at once. Still device-dependent:</p>
			<ul>
				<li>
					<strong>Auto-assigned ZettelIDs</strong> take the device's clock; two devices that index the same new note
					before the other's rename has synced give it two names.
				</li>
				<li>
					<strong>Reminders</strong> fire on every device that has the vault open; the <strong>time tracker</strong>{" "}
					runs on the device where you started it, and another device may mark the tracked event done once its saved end
					time passes.
				</li>
			</ul>
			<OutboundLink href={MULTI_DEVICE_DOC_HREF} className={cls("settings-docs-link")}>
				Multiple devices and sync — documentation
			</OutboundLink>
		</HelpBox>
	);
});

const PRESET_EXAMPLES: Array<{ name: string; description: string }> = [
	{ name: "30 min meeting", description: "Duration: 30 minutes" },
	{ name: "1 hour focus block", description: "Duration: 60 minutes, Category: Focus" },
	{ name: "Daily standup", description: "Duration: 15 min, Recurring: daily" },
	{ name: "All-day event", description: "All-day: enabled" },
];

interface EventPresetsSectionProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
}

const EventPresetsSection = memo(function EventPresetsSection({ settingsStore, plugin }: EventPresetsSectionProps) {
	const [{ eventPresets: presets, defaultPresetId }, updatePresetFields] = useSettingsFields(settingsStore, [
		"eventPresets",
		"defaultPresetId",
	]);
	const showBanner = !plugin.isProEnabled && presets.length >= FREE_MAX_EVENT_PRESETS;

	const handleDelete = useCallback(
		(presetId: string) => {
			void updatePresetFields((prev) => ({
				eventPresets: prev.eventPresets.filter((p) => p.id !== presetId),
				defaultPresetId: prev.defaultPresetId === presetId ? undefined : prev.defaultPresetId,
			}));
		},
		[updatePresetFields]
	);

	const handleDefaultChange = useCallback(
		(v: string) => {
			void updatePresetFields({ defaultPresetId: v || undefined });
		},
		[updatePresetFields]
	);

	const presetOptions: Record<string, string> = { "": "None" };
	for (const preset of presets) {
		presetOptions[preset.id] = preset.name;
	}

	return (
		<>
			<SettingHeading name="Event presets" />
			<div className="setting-item-description">
				<p>
					Create presets with pre-configured event settings (duration, category, recurring pattern, etc.) for quick
					event creation. Select a preset from the dropdown when creating an event to auto-fill the form.
				</p>
				<div className={cls("settings-info-box")}>
					<strong>Example presets:</strong>
					<ul>
						{PRESET_EXAMPLES.map((ex) => (
							<li key={ex.name} className={cls("color-example-item")}>
								<strong>{ex.name}</strong>
								<span>{` — ${ex.description}`}</span>
							</li>
						))}
					</ul>
				</div>
				<p className={cls("settings-muted")}>
					Create and edit presets from the event modal. Here you can select a default preset and delete existing ones.
				</p>
			</div>
			<SettingItem
				name="Default preset"
				description="Preset to auto-fill when opening the create event modal"
				testId={tid("settings-field-default-preset-id")}
			>
				<Dropdown
					value={defaultPresetId ?? ""}
					options={presetOptions}
					onChange={handleDefaultChange}
					testId={tid("settings-control-default-preset-id")}
				/>
			</SettingItem>
			{showBanner && (
				<ProUpgradeBanner
					featureName="Unlimited Event Presets"
					description={`Free plan supports up to ${FREE_MAX_EVENT_PRESETS} event presets. Start your 30-day free trial for unlimited presets.`}
				/>
			)}
			{presets.length === 0 ? (
				<div className={cls("event-preset-empty")}>No event presets defined. Create presets from the event modal.</div>
			) : (
				presets.map((preset) => (
					<div key={preset.id} className={cls("event-preset-item")}>
						<div className={cls("event-preset-name")}>{preset.name}</div>
						<div className={cls("event-preset-details")}>
							{preset.allDay !== undefined && (
								<span className={cls("event-preset-tag")}>{preset.allDay ? "All-day" : "Timed"}</span>
							)}
							{preset.categories && <span className={cls("event-preset-tag")}>{preset.categories}</span>}
							{preset.rruleType && <span className={cls("event-preset-tag")}>{preset.rruleType}</span>}
							{preset.futureInstancesCount && (
								<span className={cls("event-preset-tag")}>{`${preset.futureInstancesCount} instances`}</span>
							)}
							{Object.keys(preset.customProperties ?? {}).length > 0 && (
								<span
									className={cls("event-preset-tag")}
								>{`${Object.keys(preset.customProperties ?? {}).length} props`}</span>
							)}
						</div>
						<div className={cls("event-preset-controls")}>
							<button
								type="button"
								className={cls("event-preset-btn", "event-preset-btn-delete")}
								onClick={() => handleDelete(preset.id)}
							>
								Delete
							</button>
						</div>
					</div>
				))
			)}
		</>
	);
});
