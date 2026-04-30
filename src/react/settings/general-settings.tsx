import { buildUtmUrl, showWhatsNewModal } from "@real1ty-obsidian-plugins";
import {
	Dropdown,
	LicenseSection,
	SchemaSection,
	SettingCard,
	SettingHeading,
	SettingItem,
	SettingsTransferButtons,
	Toggle,
	useSettingsStore,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { renderProUpgradeBanner } from "../../components/settings/pro-upgrade-banner";
import { ACCOUNT_URL, FREE_MAX_EVENT_PRESETS } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { buildWhatsNewConfig } from "../../core/whats-new-config";
import type CustomCalendarPlugin from "../../main";
import type { CustomCalendarSettings, SingleCalendarConfig } from "../../types/settings";
import { SingleCalendarConfigSchema } from "../../types/settings";

const SHAPE = SingleCalendarConfigSchema.shape;

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
	const [settings] = useSettingsStore(settingsStore);
	const [mainSettings, updateMainSettings] = useSettingsStore(plugin.settingsStore);

	const onSecretChange = useCallback(
		async (value: string) => {
			await updateMainSettings((s) => ({ ...s, licenseKeySecretName: value }));
		},
		[updateMainSettings]
	);

	return (
		<>
			<LicenseSection
				licenseManager={plugin.licenseManager}
				currentSecretName={mainSettings.licenseKeySecretName}
				onSecretChange={onSecretChange}
				cssPrefix="prisma-"
				accountUrl={buildUtmUrl(ACCOUNT_URL, "prisma-calendar", "plugin", "settings", "manage_subscription")}
			/>
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Planning system"
				fields={PLANNING_FIELDS}
				testIdPrefix="prisma-settings-"
			/>
			<ReadOnlyField plugin={plugin} />
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Interface"
				fields={INTERFACE_FIELDS}
				testIdPrefix="prisma-settings-"
			/>
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Event defaults"
				fields={EVENT_DEFAULTS_FIELDS}
				testIdPrefix="prisma-settings-"
			/>
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Time tracker"
				fields={["showStopwatch"]}
				testIdPrefix="prisma-settings-"
			/>
			<SchemaSection
				store={settingsStore}
				shape={SHAPE}
				heading="Statistics"
				fields={["showDecimalHours", "defaultAggregationMode"]}
				testIdPrefix="prisma-settings-"
			/>
			<EventPresetsSection settings={settings} settingsStore={settingsStore} plugin={plugin} />
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
			testId="prisma-settings-field-readOnly"
		>
			<Toggle value={readOnly} onChange={handleChange} testId="prisma-settings-control-readOnly" />
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
				modalClass="prisma-settings-transfer-modal"
				testIdPrefix="prisma-settings-transfer"
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
	settings: SingleCalendarConfig;
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
}

const EventPresetsSection = memo(function EventPresetsSection({
	settings,
	settingsStore,
	plugin,
}: EventPresetsSectionProps) {
	const presets = settings.eventPresets;
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
				`Free plan supports up to ${FREE_MAX_EVENT_PRESETS} event presets. Upgrade to Pro for unlimited presets.`
			);
		}
	}, [showBanner]);

	const handleDelete = useCallback(
		(presetId: string) => {
			void settingsStore.updateSettings((s) => ({
				...s,
				eventPresets: s.eventPresets.filter((p) => p.id !== presetId),
				defaultPresetId: s.defaultPresetId === presetId ? undefined : s.defaultPresetId,
			}));
		},
		[settingsStore]
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
				<div className="prisma-settings-info-box">
					<strong>Example presets:</strong>
					<ul>
						{PRESET_EXAMPLES.map((ex) => (
							<li key={ex.name} className="prisma-color-example-item">
								<strong>{ex.name}</strong>
								<span>{` — ${ex.description}`}</span>
							</li>
						))}
					</ul>
				</div>
				<p className="prisma-settings-muted">
					Create and edit presets from the event modal. Here you can select a default preset and delete existing ones.
				</p>
			</div>
			<SettingItem
				name="Default preset"
				description="Preset to auto-fill when opening the create event modal"
				testId="prisma-settings-field-defaultPresetId"
			>
				<Dropdown
					value={settings.defaultPresetId ?? ""}
					options={presetOptions}
					onChange={(v) => void settingsStore.updateSettings((s) => ({ ...s, defaultPresetId: v || undefined }))}
					testId="prisma-settings-control-defaultPresetId"
				/>
			</SettingItem>
			<div ref={bannerRef} />
			{presets.length === 0 ? (
				<div className="prisma-event-preset-empty">No event presets defined. Create presets from the event modal.</div>
			) : (
				presets.map((preset) => (
					<div key={preset.id} className="prisma-event-preset-item">
						<div className="prisma-event-preset-name">{preset.name}</div>
						<div className="prisma-event-preset-details">
							{preset.allDay !== undefined && (
								<span className="prisma-event-preset-tag">{preset.allDay ? "All-day" : "Timed"}</span>
							)}
							{preset.categories && <span className="prisma-event-preset-tag">{preset.categories}</span>}
							{preset.rruleType && <span className="prisma-event-preset-tag">{preset.rruleType}</span>}
							{preset.futureInstancesCount && (
								<span className="prisma-event-preset-tag">{`${preset.futureInstancesCount} instances`}</span>
							)}
							{Object.keys(preset.customProperties ?? {}).length > 0 && (
								<span className="prisma-event-preset-tag">{`${Object.keys(preset.customProperties ?? {}).length} props`}</span>
							)}
						</div>
						<div className="prisma-event-preset-controls">
							<button
								type="button"
								className="prisma-event-preset-btn prisma-event-preset-btn-delete"
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
		showWhatsNewModal(plugin.app, plugin, config, "0.0.0", plugin.manifest.version);
	}, [plugin]);

	return (
		<>
			<SettingHeading name="Help & support" />
			<SettingCard cssPrefix="prisma-" testId="prisma-settings-help">
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
					inside notes, and other power-user capabilities built for serious planning inside Obsidian.
				</p>
			</SettingCard>
			<SettingItem
				name="Changelog"
				description="Browse the full changelog with every update since the first release"
				testId="prisma-settings-field-changelog"
			>
				<button type="button" onClick={handleViewChangelog} data-testid="prisma-settings-changelog-btn">
					View changelog
				</button>
			</SettingItem>
		</>
	);
});
