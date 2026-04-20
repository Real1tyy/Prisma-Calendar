import type { App } from "obsidian";

import { showReactModal } from "../../show-react-modal";
import type { SettingsTransferStrings, TransferMode } from "./transfer-panel";
import { DEFAULT_TRANSFER_STRINGS, TransferPanel } from "./transfer-panel";

export interface SettingsTransferModalConfig {
	app: App;
	mode: TransferMode;
	initialJson: string;
	filename: string;
	onImport: (parsed: unknown) => Promise<void>;
	strings?: Partial<SettingsTransferStrings> | undefined;
	cls?: string | undefined;
	testIdPrefix?: string | undefined;
}

export function openTransferModal(config: SettingsTransferModalConfig): void {
	const strings: SettingsTransferStrings = { ...DEFAULT_TRANSFER_STRINGS, ...config.strings };
	showReactModal({
		app: config.app,
		cls: config.cls,
		title: config.mode === "export" ? strings.exportTitle : strings.importTitle,
		testId: config.testIdPrefix ? `${config.testIdPrefix}-modal` : undefined,
		render: (close) => (
			<TransferPanel
				mode={config.mode}
				initialJson={config.initialJson}
				filename={config.filename}
				strings={strings}
				onImport={config.onImport}
				close={close}
				{...(config.testIdPrefix ? { testIdPrefix: config.testIdPrefix } : {})}
			/>
		),
	});
}
