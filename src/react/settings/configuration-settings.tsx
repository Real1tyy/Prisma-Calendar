import { SettingHeading, Toggle, useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useMemo } from "react";

import { BATCH_BUTTON_IDS, BATCH_BUTTON_LABELS, TOOLBAR_BUTTON_IDS, TOOLBAR_BUTTON_LABELS } from "../../constants";
import type { CalendarSettingsStore, ToolbarButtonsKey } from "../../core/settings-store";

interface ConfigurationSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const TOOLBAR_WARNING = "\u26A0\uFE0F Reopen the calendar view for changes to take effect.";

export const ConfigurationSettingsReact = memo(function ConfigurationSettingsReact({
	settingsStore,
}: ConfigurationSettingsProps) {
	return (
		<>
			<ToolbarSection
				settingsStore={settingsStore}
				heading="Desktop toolbar buttons"
				description={`Choose which buttons to display in the calendar toolbar on desktop. Uncheck items to hide them and save space in narrow sidebars. ${TOOLBAR_WARNING}`}
				configKey="toolbarButtons"
			/>
			<ToolbarSection
				settingsStore={settingsStore}
				heading="Mobile toolbar buttons"
				description={`Choose which buttons to display in the calendar toolbar on mobile. Uncheck items to hide them and save space on smaller screens. ${TOOLBAR_WARNING}`}
				configKey="mobileToolbarButtons"
			/>
			<BatchSelectionSection settingsStore={settingsStore} />
		</>
	);
});

interface ToolbarSectionProps {
	settingsStore: CalendarSettingsStore;
	heading: string;
	description: string;
	configKey: ToolbarButtonsKey;
}

const ToolbarSection = memo(function ToolbarSection({
	settingsStore,
	heading,
	description,
	configKey,
}: ToolbarSectionProps) {
	const [settings] = useSettingsStore(settingsStore);
	const enabled = useMemo(() => new Set(settings[configKey]), [settings, configKey]);

	const handleToggle = useCallback(
		(buttonId: string, value: boolean) => {
			void settingsStore.toggleToolbarButton(configKey, buttonId, value);
		},
		[settingsStore, configKey]
	);

	return (
		<>
			<SettingHeading name={heading} />
			<div className="setting-item">
				<div className="setting-item-info">
					<div className="setting-item-name">{heading}</div>
					<div className="setting-item-description">{description}</div>
				</div>
				<div className="setting-item-control" />
			</div>
			<div className="prisma-batch-buttons-container">
				{TOOLBAR_BUTTON_IDS.map((buttonId) => (
					<div key={buttonId} className="setting-item prisma-batch-button-setting">
						<div className="setting-item-info">
							<div className="setting-item-name">{TOOLBAR_BUTTON_LABELS[buttonId] || buttonId}</div>
						</div>
						<div className="setting-item-control">
							<Toggle value={enabled.has(buttonId)} onChange={(v) => handleToggle(buttonId, v)} />
						</div>
					</div>
				))}
			</div>
		</>
	);
});

interface BatchSelectionSectionProps {
	settingsStore: CalendarSettingsStore;
}

const BatchSelectionSection = memo(function BatchSelectionSection({ settingsStore }: BatchSelectionSectionProps) {
	const [settings, updateSettings] = useSettingsStore(settingsStore);
	const enabled = useMemo(() => new Set(settings.batchActionButtons), [settings.batchActionButtons]);

	const handleToggle = useCallback(
		(buttonId: string, value: boolean) => {
			void updateSettings((s) => {
				const current = s.batchActionButtons;
				const updated = value
					? BATCH_BUTTON_IDS.filter((id) => current.includes(id) || id === buttonId)
					: current.filter((id) => id !== buttonId);
				return { ...s, batchActionButtons: updated };
			});
		},
		[updateSettings]
	);

	return (
		<>
			<SettingHeading name="Batch selection" />
			<div className="setting-item">
				<div className="setting-item-info">
					<div className="setting-item-name">Batch action buttons</div>
					<div className="setting-item-description">
						Choose which action buttons to display in batch selection mode toolbar. The counter and exit buttons are
						always shown.
					</div>
				</div>
				<div className="setting-item-control" />
			</div>
			<div className="prisma-batch-buttons-container">
				{BATCH_BUTTON_IDS.map((buttonId) => (
					<div key={buttonId} className="setting-item prisma-batch-button-setting">
						<div className="setting-item-info">
							<div className="setting-item-name">{BATCH_BUTTON_LABELS[buttonId] || buttonId}</div>
						</div>
						<div className="setting-item-control">
							<Toggle value={enabled.has(buttonId)} onChange={(v) => handleToggle(buttonId, v)} />
						</div>
					</div>
				))}
			</div>
		</>
	);
});
