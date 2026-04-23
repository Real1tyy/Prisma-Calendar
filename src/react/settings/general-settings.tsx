import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import {
	Dropdown,
	LicenseSection,
	NumberInput,
	SettingCard,
	SettingHeading,
	SettingItem,
	SettingsTransferButtons,
	TextInput,
	Toggle,
	useSettingsStore,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { renderProUpgradeBanner } from "../../components/settings/pro-upgrade-banner";
import { ACCOUNT_URL, FREE_MAX_EVENT_PRESETS } from "../../core/license";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { CustomCalendarSettings, SingleCalendarConfig } from "../../types/settings";
import { LOCALE_OPTIONS } from "../../types/view";

const PRISMA_NON_TRANSFERABLE_SETTINGS: ReadonlyArray<keyof CustomCalendarSettings> = [
	"licenseKeySecretName",
	"version",
];

const DOCS_BASE = "https://real1tyy.github.io/Prisma-Calendar";
const GITHUB_ISSUES_URL = "https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose";

interface GeneralSettingsProps {
	settingsStore: CalendarSettingsStore;
	plugin: CustomCalendarPlugin;
}

export const GeneralSettingsReact = memo(function GeneralSettingsReact({
	settingsStore,
	plugin,
}: GeneralSettingsProps) {
	const [settings, updateSettings] = useSettingsStore(settingsStore);
	const [mainSettings, updateMainSettings] = useSettingsStore(plugin.settingsStore);

	const updateField = useCallback(
		<K extends keyof SingleCalendarConfig>(key: K, value: SingleCalendarConfig[K]) => {
			void updateSettings((s) => ({ ...s, [key]: value }));
		},
		[updateSettings]
	);

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
			<DirectorySection settings={settings} updateField={updateField} plugin={plugin} />
			<ParsingSection settings={settings} updateField={updateField} />
			<StopwatchSection settings={settings} updateField={updateField} />
			<StatisticsSection settings={settings} updateField={updateField} />
			<EventPresetsSection settings={settings} updateField={updateField} plugin={plugin} />
			<SettingsTransferSection plugin={plugin} />
			<HelpSection />
		</>
	);
});

interface SettingsTransferSectionProps {
	plugin: CustomCalendarPlugin;
}

const SettingsTransferSection = memo(function SettingsTransferSection({ plugin }: SettingsTransferSectionProps) {
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

type UpdateField = <K extends keyof SingleCalendarConfig>(key: K, value: SingleCalendarConfig[K]) => void;

interface SectionProps {
	settings: SingleCalendarConfig;
	updateField: UpdateField;
}

interface DirectorySectionProps extends SectionProps {
	plugin: CustomCalendarPlugin;
}

const DirectorySection = memo(function DirectorySection({ settings, updateField, plugin }: DirectorySectionProps) {
	const [readOnly, setReadOnly] = useState(plugin.syncStore.data.readOnly);
	const handleReadOnlyChange = useCallback(
		(value: boolean) => {
			setReadOnly(value);
			void plugin.syncStore.updateData({ readOnly: value });
		},
		[plugin]
	);

	return (
		<>
			<SettingHeading name="Calendar directory" />
			<SettingItem
				name="Directory"
				description="Folder to scan for calendar events and create new events in"
				testId="prisma-settings-field-directory"
			>
				<TextInput
					value={settings.directory}
					placeholder="e.g., tasks, calendar, events"
					onChange={(v) => updateField("directory", v)}
					testId="prisma-settings-control-directory"
				/>
			</SettingItem>
			<SettingItem
				name="Template path"
				description="Path to Templater template file for new events (optional, requires Templater plugin)"
				testId="prisma-settings-field-templatePath"
			>
				<TextInput
					value={settings.templatePath ?? ""}
					placeholder="e.g., Templates/event-template.md"
					onChange={(v) => updateField("templatePath", v || undefined)}
					testId="prisma-settings-control-templatePath"
				/>
			</SettingItem>
			<SettingItem
				name="Locale"
				description="Language and date format for calendar headings, day names, month names, toolbar labels, and date displays"
				testId="prisma-settings-field-locale"
			>
				<Dropdown
					value={settings.locale}
					options={LOCALE_OPTIONS}
					onChange={(v) => updateField("locale", v as SingleCalendarConfig["locale"])}
					testId="prisma-settings-control-locale"
				/>
			</SettingItem>
			<SettingItem
				name="Show ribbon icon"
				description="Display a calendar icon in the left sidebar to quickly open this calendar"
				testId="prisma-settings-field-showRibbonIcon"
			>
				<Toggle
					value={settings.showRibbonIcon}
					onChange={(v) => updateField("showRibbonIcon", v)}
					testId="prisma-settings-control-showRibbonIcon"
				/>
			</SettingItem>
			<SettingItem
				name="Enable keyboard navigation"
				description="Use left/right arrow keys to navigate between calendar intervals. Automatically disabled when search or expression filter inputs are focused."
				testId="prisma-settings-field-enableKeyboardNavigation"
			>
				<Toggle
					value={settings.enableKeyboardNavigation}
					onChange={(v) => updateField("enableKeyboardNavigation", v)}
					testId="prisma-settings-control-enableKeyboardNavigation"
				/>
			</SettingItem>
			<SettingItem
				name="Auto assign zettel ID"
				description="Automatically add a Zettel ID timestamp to filenames of events in the calendar directory that don't have one."
				testId="prisma-settings-field-autoAssignZettelId"
			>
				<Dropdown
					value={settings.autoAssignZettelId}
					options={{
						disabled: "Disabled",
						calendarEvents: "Calendar events only",
						allEvents: "All events",
					}}
					onChange={(v) => updateField("autoAssignZettelId", v as SingleCalendarConfig["autoAssignZettelId"])}
					testId="prisma-settings-control-autoAssignZettelId"
				/>
			</SettingItem>
			<SettingItem
				name="Index subdirectories"
				description="Index event files anywhere under the configured folder, not just immediate children. When enabled, events stored at any depth (e.g., courses/CS101/HW1.md) appear on the calendar."
				testId="prisma-settings-field-indexSubdirectories"
			>
				<Toggle
					value={settings.indexSubdirectories}
					onChange={(v) => updateField("indexSubdirectories", v)}
					testId="prisma-settings-control-indexSubdirectories"
				/>
			</SettingItem>
			<SettingItem
				name="Read-only mode"
				description="Prevent automatic file modifications. When enabled, the plugin will not automatically write to files (notifications, recurring event generation). Manual actions like propagation will still work. Stored in sync.json to prevent syncing across devices."
				testId="prisma-settings-field-readOnly"
			>
				<Toggle value={readOnly} onChange={handleReadOnlyChange} testId="prisma-settings-control-readOnly" />
			</SettingItem>
		</>
	);
});

const ParsingSection = memo(function ParsingSection({ settings, updateField }: SectionProps) {
	return (
		<>
			<SettingHeading name="Parsing" />
			<SettingItem
				name="Default duration (minutes)"
				description="Default event duration when only start time is provided"
				testId="prisma-settings-field-defaultDurationMinutes"
			>
				<NumberInput
					value={settings.defaultDurationMinutes}
					min={1}
					onChange={(v) => updateField("defaultDurationMinutes", v)}
					testId="prisma-settings-control-defaultDurationMinutes"
				/>
			</SettingItem>
			<SettingItem
				name="Show duration field in event modal"
				description="Display a duration in minutes field in the event creation/edit modal for quick editing. Changes to duration automatically update the end date, and vice versa."
				testId="prisma-settings-field-showDurationField"
			>
				<Toggle
					value={settings.showDurationField}
					onChange={(v) => updateField("showDurationField", v)}
					testId="prisma-settings-control-showDurationField"
				/>
			</SettingItem>
			<SettingItem
				name="Mark past events as done"
				description="Automatically mark past events as done during startup by updating their status property."
				testId="prisma-settings-field-markPastInstancesAsDone"
			>
				<Toggle
					value={settings.markPastInstancesAsDone}
					onChange={(v) => updateField("markPastInstancesAsDone", v)}
					testId="prisma-settings-control-markPastInstancesAsDone"
				/>
			</SettingItem>
			<SettingItem
				name="Title autocomplete"
				description="Show autocomplete suggestions based on existing event titles when typing in the title field"
				testId="prisma-settings-field-titleAutocomplete"
			>
				<Toggle
					value={settings.titleAutocomplete}
					onChange={(v) => updateField("titleAutocomplete", v)}
					testId="prisma-settings-control-titleAutocomplete"
				/>
			</SettingItem>
		</>
	);
});

const StopwatchSection = memo(function StopwatchSection({ settings, updateField }: SectionProps) {
	return (
		<>
			<SettingHeading name="Time tracker" />
			<SettingItem
				name="Show time tracker in event modal"
				description="Display a stopwatch in the event creation/edit modal for precise time tracking."
				testId="prisma-settings-field-showStopwatch"
			>
				<Toggle
					value={settings.showStopwatch}
					onChange={(v) => updateField("showStopwatch", v)}
					testId="prisma-settings-control-showStopwatch"
				/>
			</SettingItem>
		</>
	);
});

const StatisticsSection = memo(function StatisticsSection({ settings, updateField }: SectionProps) {
	return (
		<>
			<SettingHeading name="Statistics" />
			<SettingItem
				name="Show decimal hours"
				description="Display durations as decimal hours instead of hours:minutes"
				testId="prisma-settings-field-showDecimalHours"
			>
				<Toggle
					value={settings.showDecimalHours}
					onChange={(v) => updateField("showDecimalHours", v)}
					testId="prisma-settings-control-showDecimalHours"
				/>
			</SettingItem>
			<SettingItem
				name="Default grouping mode"
				description="How to group events in statistics views"
				testId="prisma-settings-field-defaultAggregationMode"
			>
				<Dropdown
					value={settings.defaultAggregationMode}
					options={{
						name: "Event Name",
						category: "Category",
					}}
					onChange={(v) => updateField("defaultAggregationMode", v as SingleCalendarConfig["defaultAggregationMode"])}
					testId="prisma-settings-control-defaultAggregationMode"
				/>
			</SettingItem>
		</>
	);
});

const PRESET_EXAMPLES: Array<{ name: string; description: string }> = [
	{ name: "30 min meeting", description: "Duration: 30 minutes" },
	{ name: "1 hour focus block", description: "Duration: 60 minutes, Category: Focus" },
	{ name: "Daily standup", description: "Duration: 15 min, Recurring: daily" },
	{ name: "All-day event", description: "All-day: enabled" },
];

const EventPresetsSection = memo(function EventPresetsSection({
	settings,
	updateField,
	plugin,
}: SectionProps & { plugin: CustomCalendarPlugin }) {
	const presets = settings.eventPresets ?? [];
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
			updateField(
				"eventPresets",
				presets.filter((p) => p.id !== presetId)
			);
			if (settings.defaultPresetId === presetId) {
				updateField("defaultPresetId", undefined);
			}
		},
		[presets, settings.defaultPresetId, updateField]
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
					onChange={(v) => updateField("defaultPresetId", v || undefined)}
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

export const HelpSection = memo(function HelpSection() {
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
							"help_troubleshooting",
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
			</SettingCard>
		</>
	);
});
