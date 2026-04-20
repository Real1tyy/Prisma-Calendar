import type { SettingsTransferOptions } from "@real1ty-obsidian-plugins";
import {
	applyTransferredSettings,
	confirmAction,
	createTransferableSettingsSnapshot,
	SETTINGS_TRANSFER_DEFAULT_FILENAME,
} from "@real1ty-obsidian-plugins";
import { Notice } from "obsidian";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { SettingItem } from "../../components/setting-item";
import { useApp } from "../../contexts/app-context";
import type { SettingsStorelike } from "../../hooks/use-settings-store";
import { openTransferModal } from "./transfer-modal";
import type { SettingsTransferStrings } from "./transfer-panel";

export interface SettingsTransferButtonsProps<T extends Record<string, unknown>> {
	store: SettingsStorelike<T>;
	defaults: T;
	nonTransferableKeys?: SettingsTransferOptions["nonTransferableKeys"];
	/** Filename used for the downloaded JSON. Defaults to `plugin-settings.json`. */
	filename?: string;
	/** Called after a successful import has been persisted to the store. */
	onImport?: (newSettings: T) => void | Promise<void>;
	/** Called after a successful reset has been persisted to the store. */
	onReset?: (newSettings: T) => void | Promise<void>;
	/** Row heading shown in the settings tab. */
	name?: string;
	/** Row description. The default mentions the import-overwrite behavior. */
	description?: ReactNode;
	/** Labels for buttons + modals. Pass partial overrides to swap individual strings. */
	strings?: Partial<SettingsTransferStrings>;
	importButtonText?: string;
	exportButtonText?: string;
	resetButtonText?: string;
	resetConfirmTitle?: string;
	resetConfirmMessage?: string;
	resetSuccessMessage?: string;
	/** Hide the reset button entirely. Default: false (button is shown). */
	hideResetButton?: boolean;
	/** CSS class added to the modal elements. Use for scoping styles per-plugin. */
	modalClass?: string;
	testIdPrefix?: string;
}

function SettingsTransferButtonsInner<T extends Record<string, unknown>>({
	store,
	defaults,
	nonTransferableKeys,
	filename = SETTINGS_TRANSFER_DEFAULT_FILENAME,
	onImport,
	onReset,
	name = "Import and export settings",
	description = "Export or import settings as JSON. Importing or resetting replaces all settings.",
	strings,
	importButtonText = "Import",
	exportButtonText = "Export",
	resetButtonText = "Reset to defaults",
	resetConfirmTitle = "Reset settings?",
	resetConfirmMessage = "All settings will be restored to their defaults. This cannot be undone.",
	resetSuccessMessage = "Settings reset to defaults.",
	hideResetButton = false,
	modalClass,
	testIdPrefix,
}: SettingsTransferButtonsProps<T>) {
	const app = useApp();
	const transferOpts: SettingsTransferOptions | undefined = nonTransferableKeys ? { nonTransferableKeys } : undefined;

	const openModal = useCallback(
		(mode: "export" | "import", initialJson: string, onModalImport: (parsed: unknown) => Promise<void>) => {
			openTransferModal({
				app,
				mode,
				initialJson,
				filename,
				strings,
				onImport: onModalImport,
				cls: modalClass,
				testIdPrefix,
			});
		},
		[app, filename, strings, modalClass, testIdPrefix]
	);

	const openExport = useCallback(() => {
		const payload = createTransferableSettingsSnapshot(store.settings$.getValue(), defaults, transferOpts);
		openModal("export", JSON.stringify(payload, null, 2), async () => {});
	}, [store, defaults, transferOpts, openModal]);

	const openImport = useCallback(() => {
		openModal("import", "", async (parsed: unknown) => {
			await store.updateSettings((current) => applyTransferredSettings(current, parsed, defaults, transferOpts));
			if (onImport) {
				await onImport(store.settings$.getValue());
			}
		});
	}, [store, defaults, transferOpts, onImport, openModal]);

	const handleReset = useCallback(async () => {
		const confirmed = await confirmAction(app, {
			title: resetConfirmTitle,
			message: resetConfirmMessage,
			confirmButton: { text: resetButtonText, warning: true },
		});
		if (!confirmed) return;
		await store.updateSettings((current) => applyTransferredSettings(current, {}, defaults, transferOpts));
		if (onReset) {
			await onReset(store.settings$.getValue());
		}
		new Notice(resetSuccessMessage);
	}, [
		app,
		store,
		defaults,
		transferOpts,
		onReset,
		resetButtonText,
		resetConfirmTitle,
		resetConfirmMessage,
		resetSuccessMessage,
	]);

	const tid = (suffix: string) => (testIdPrefix ? `${testIdPrefix}-${suffix}` : undefined);

	return (
		<SettingItem name={name} description={description} testId={tid("row")}>
			<button type="button" onClick={openImport} data-testid={tid("import-button")}>
				{importButtonText}
			</button>
			<button type="button" onClick={openExport} data-testid={tid("export-button")}>
				{exportButtonText}
			</button>
			{!hideResetButton && (
				<button type="button" className="mod-warning" onClick={handleReset} data-testid={tid("reset-button")}>
					{resetButtonText}
				</button>
			)}
		</SettingItem>
	);
}

export const SettingsTransferButtons = memo(SettingsTransferButtonsInner) as typeof SettingsTransferButtonsInner;
