import type { App } from "obsidian";

import { showReactModal } from "../../show-react-modal";
import {
	DEFAULT_TRANSFER_STRINGS,
	TransferPanel,
	type SettingsTransferStrings,
	type TransferMode,
} from "./transfer-panel";

export interface SettingsTransferModalConfig {
	app: App;
	mode: TransferMode;
	initialJson: string;
	filename: string;
	onImport: (parsed: unknown) => Promise<void>;
	strings?: Partial<SettingsTransferStrings> | undefined;
	/** Space-separated class tokens applied to the modal root. */
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
		...(config.testIdPrefix !== undefined ? { testIdPrefix: config.testIdPrefix } : {}),
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
