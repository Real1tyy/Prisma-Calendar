import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import {
	Dropdown,
	LicenseSection,
	SettingCard,
	SettingHeading,
	SettingItem,
	SettingsTransferButtons,
	showWhatsNewReactModal,
	Toggle,
	useSchemaField,
	useSettingsFields,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { renderProUpgradeBanner } from "../../components/settings/pro-upgrade-banner";
import { cls, tid } from "../../constants";
import { ACCOUNT_URL, FREE_MAX_EVENT_PRESETS } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { buildWhatsNewConfig } from "../../core/whats-new-config";
import type CustomCalendarPlugin from "../../main";
import type { CustomCalendarSettings } from "../../types/settings";
import { CustomCalendarSettingsSchema, SingleCalendarConfigSchema } from "../../types/settings";
import { PrismaSection } from "./_section";

const SHAPE = SingleCalendarConfigSchema.shape;
const MAIN_SHAPE = CustomCalendarSettingsSchema.shape;

const PRISMA_NON_TRANSFERABLE_SETTINGS: ReadonlyArray<keyof CustomCalendarSettings> = [
	"licenseKeySecretName",
	"version",
];

const DOCS_BASE = "https://real1tyy.github.io/Prisma-Calendar";
const GITHUB_ISSUES_URL = "https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose";

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
		async (value: string) => {
			setLicenseKeySecretName(value);
		},
		[setLicenseKeySecretName]
	);

	const calendarSection = (heading: string, fields: string[]) => (
		<PrismaSection store={settingsStore} shape={SHAPE} heading={heading} fields={fields} />
	);
	const mainSection = (heading: string, fields: string[]) => (
		<PrismaSection store={plugin.settingsStore} shape={MAIN_SHAPE} heading={heading} fields={fields} />
	);

	return (
		<>
			<LicenseSection
				licenseManager={plugin.licenseManager}
				currentSecretName={licenseKeySecretName}
				onSecretChange={onSecretChange}
				accountUrl={buildUtmUrl(ACCOUNT_URL, "prisma-calendar", "plugin", "settings", "manage_subscription")}
			/>
			{calendarSection("Planning system", PLANNING_FIELDS)}
			<ReadOnlyField plugin={plugin} />
			{calendarSection("Interface", INTERFACE_FIELDS)}
			{mainSection("Updates", ["checkForReleaseUpdates"])}
			{calendarSection("Event defaults", EVENT_DEFAULTS_FIELDS)}
			{calendarSection("Time tracker", ["showStopwatch"])}
			{calendarSection("Statistics", ["showDecimalHours", "defaultAggregationMode"])}
			<EventPresetsSection settingsStore={settingsStore} plugin={plugin} />
			<SettingsTransferSection plugin={plugin} />
			<HelpSection plugin={plugin} />
		</>
	);
});

const ReadOnlyField = memo(function ReadOnlyField({ plugin }: { plugin: CustomCalendarPlugin }) {
	const [readOnly, setReadOnly] = useState(plugin.syncStore.data.readOnly);
	const handleChange = useCallback(
		(value: boolean) => {
			setReadOnly(value);
			void plugin.syncStore.updateData({ readOnly: value });
		},
		[plugin]
	);

	return (
		<SettingItem
			name="Read-only mode"
			description="Prevent automatic file modifications. When enabled, the plugin will not automatically write to files (notifications, recurring event generation). Manual actions like propagation will still work. Stored in sync.json to prevent syncing across devices."
			testId={tid("settings-field-readOnly")}
		>
			<Toggle value={readOnly} onChange={handleChange} testId={tid("settings-control-readOnly")} />
		</SettingItem>
	);
});

const SettingsTransferSection = memo(function SettingsTransferSection({ plugin }: { plugin: CustomCalendarPlugin }) {
	return (
		<>
			<SettingHeading name="Settings transfer" />
			<SettingsTransferButtons
				store={plugin.settingsStore}
				defaults={plugin.settingsStore.getDefaults()}
				nonTransferableKeys={PRISMA_NON_TRANSFERABLE_SETTINGS}
				filename="prisma-calendar-settings.json"
				modalClass={cls("settings-transfer-modal")}
				testIdPrefix={tid("settings-transfer")}
			/>
		</>
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

	const bannerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = bannerRef.current;
		if (!el) return;
		el.empty();
		if (showBanner) {
			renderProUpgradeBanner(
				el,
				"Unlimited Event Presets",
				`Free plan supports up to ${FREE_MAX_EVENT_PRESETS} event presets. Start your 30-day free trial for unlimited presets.`
			);
		}
	}, [showBanner]);

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
				testId={tid("settings-field-defaultPresetId")}
			>
				<Dropdown
					value={defaultPresetId ?? ""}
					options={presetOptions}
					onChange={handleDefaultChange}
					testId={tid("settings-control-defaultPresetId")}
				/>
			</SettingItem>
			<div ref={bannerRef} />
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

export const HelpSection = memo(function HelpSection({ plugin }: { plugin: CustomCalendarPlugin }) {
	const handleViewChangelog = useCallback(() => {
		const config = buildWhatsNewConfig(plugin.changelogContent, "settings");
		showWhatsNewReactModal(plugin.app, plugin, config, "0.0.0", plugin.manifest.version);
	}, [plugin]);

	return (
		<>
			<SettingHeading name="Help & support" />
			<SettingCard testId={tid("settings-help")}>
				<p>
					Thanks for giving Prisma a try. I hope you enjoy using it, and that it helps you become more productive and
					organized inside Obsidian.
				</p>
				<p>
					Have a question? The{" "}
					<a href={buildUtmUrl(DOCS_BASE, "prisma-calendar", "plugin", "settings", "help_documentation")}>
						<strong>documentation</strong>
					</a>{" "}
					covers most topics — use the search bar in the top right to quickly find what you need. Check the{" "}
					<a href={buildUtmUrl(`${DOCS_BASE}/faq`, "prisma-calendar", "plugin", "settings", "help_faq")}>
						<strong>frequently asked questions</strong>
					</a>{" "}
					or{" "}
					<a
						href={buildUtmUrl(
							`${DOCS_BASE}/troubleshooting`,
							"prisma-calendar",
							"plugin",
							"settings",
							"help_troubleshooting"
						)}
					>
						<strong>troubleshooting</strong>
					</a>{" "}
					pages for common issues and solutions.
				</p>
				<p>
					If you spot any bugs or see ways to improve it, don't hesitate to share your feedback — please{" "}
					<a href={GITHUB_ISSUES_URL}>
						<strong>create a GitHub issue</strong>
					</a>
					. I would love to hear your thoughts.
				</p>
				<p>
					For more connected, advanced workflows,{" "}
					<a
						href={buildUtmUrl(
							"https://matejvavroproductivity.com/tools/prisma-calendar/",
							"prisma-calendar",
							"plugin",
							"settings",
							"help_pro"
						)}
					>
						<strong>Prisma Pro</strong>
					</a>{" "}
					unlocks external synchronization, advanced visualizations, Bases integration for embedding views directly
					inside notes, and other power-user capabilities built for serious planning inside Obsidian.{" "}
					<a
						href={buildUtmUrl(
							"https://matejvavroproductivity.com/tools/prisma-calendar/",
							"prisma-calendar",
							"plugin",
							"settings",
							"help_free_trial"
						)}
					>
						<strong>Try every Pro feature with a 30-day free trial</strong>
					</a>{" "}
					— cancel anytime.
				</p>
			</SettingCard>
			<SettingItem
				name="Changelog"
				description="Browse the full changelog with every update since the first release"
				testId={tid("settings-field-changelog")}
			>
				<button type="button" onClick={handleViewChangelog} data-testid={tid("settings-changelog-btn")}>
					View changelog
				</button>
			</SettingItem>
		</>
	);
});
