import { SettingHeading, Toggle, useSchemaField } from "@real1ty/obsidian-plugins-react";
import { memo, useCallback, useMemo } from "react";

import {
	BATCH_BUTTON_IDS,
	BATCH_BUTTON_LABELS,
	cls,
	tid,
	TOOLBAR_BUTTON_IDS,
	TOOLBAR_BUTTON_LABELS,
} from "../../constants";
import { FILE_MENU_ACTION_IDS, FILE_MENU_ACTION_LABELS } from "../../context-menu-items";
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
			<FileMenuSection
				settingsStore={settingsStore}
				heading="File explorer menu"
				description="Choose which Prisma actions appear when you right-click one of this planning system's notes in the file explorer. Uncheck every action to add nothing there."
				configKey="fileMenuExplorerActions"
			/>
			<FileMenuSection
				settingsStore={settingsStore}
				heading="Note header menu"
				description="Choose which Prisma actions appear in a note's tab and its ⋮ More options menu. Uncheck every action to add nothing there."
				configKey="fileMenuHeaderActions"
			/>
		</>
	);
});

type FileMenuActionsKey = "fileMenuExplorerActions" | "fileMenuHeaderActions";

interface FileMenuSectionProps {
	settingsStore: CalendarSettingsStore;
	heading: string;
	description: string;
	configKey: FileMenuActionsKey;
}

/**
 * Both surfaces are driven by Obsidian's single `file-menu` event, told apart by
 * its `source` — so they are two independent lists rather than one shared list
 * with a per-surface override.
 */
const FileMenuSection = memo(function FileMenuSection({
	settingsStore,
	heading,
	description,
	configKey,
}: FileMenuSectionProps) {
	const [actions, setActions] = useSchemaField(settingsStore, configKey);
	const enabled = useMemo(() => new Set(actions), [actions]);

	const handleToggle = useCallback(
		(actionId: string, value: boolean) => {
			setActions((current) =>
				value
					? FILE_MENU_ACTION_IDS.filter((id) => current.includes(id) || id === actionId)
					: current.filter((id) => id !== actionId)
			);
		},
		[setActions]
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
			<div className={cls("batch-buttons-container")}>
				{FILE_MENU_ACTION_IDS.map((actionId) => (
					<div
						key={actionId}
						className="setting-item prisma-batch-button-setting"
						data-testid={tid("settings-field", configKey, actionId)}
					>
						<div className="setting-item-info">
							<div className="setting-item-name">{FILE_MENU_ACTION_LABELS[actionId]}</div>
						</div>
						<div className="setting-item-control">
							<Toggle
								value={enabled.has(actionId)}
								onChange={(v) => handleToggle(actionId, v)}
								testId={tid("settings-control", configKey, actionId)}
							/>
						</div>
					</div>
				))}
			</div>
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
	const [buttons] = useSchemaField(settingsStore, configKey);
	const enabled = useMemo(() => new Set(buttons), [buttons]);

	const handleToggle = useCallback(
		(buttonId: string, value: boolean) => void settingsStore.toggleToolbarButton(configKey, buttonId, value),
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
			<div className={cls("batch-buttons-container")}>
				{TOOLBAR_BUTTON_IDS.map((buttonId) => (
					<div
						key={buttonId}
						className="setting-item prisma-batch-button-setting"
						data-testid={tid("settings-field", configKey, buttonId)}
					>
						<div className="setting-item-info">
							<div className="setting-item-name">{TOOLBAR_BUTTON_LABELS[buttonId] || buttonId}</div>
						</div>
						<div className="setting-item-control">
							<Toggle
								value={enabled.has(buttonId)}
								onChange={(v) => handleToggle(buttonId, v)}
								testId={tid("settings-control", configKey, buttonId)}
							/>
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
	const [batchActionButtons, setBatchActionButtons] = useSchemaField(settingsStore, "batchActionButtons");
	const enabled = useMemo(() => new Set(batchActionButtons), [batchActionButtons]);

	const handleToggle = useCallback(
		(buttonId: string, value: boolean) => {
			setBatchActionButtons((current) =>
				value
					? BATCH_BUTTON_IDS.filter((id) => current.includes(id) || id === buttonId)
					: current.filter((id) => id !== buttonId)
			);
		},
		[setBatchActionButtons]
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
			<div className={cls("batch-buttons-container")}>
				{BATCH_BUTTON_IDS.map((buttonId) => (
					<div
						key={buttonId}
						className="setting-item prisma-batch-button-setting"
						data-testid={tid("settings-field-batch-action-buttons", buttonId)}
					>
						<div className="setting-item-info">
							<div className="setting-item-name">{BATCH_BUTTON_LABELS[buttonId] || buttonId}</div>
						</div>
						<div className="setting-item-control">
							<Toggle
								value={enabled.has(buttonId)}
								onChange={(v) => handleToggle(buttonId, v)}
								testId={tid("settings-control-batch-action-buttons", buttonId)}
							/>
						</div>
					</div>
				))}
			</div>
		</>
	);
});
