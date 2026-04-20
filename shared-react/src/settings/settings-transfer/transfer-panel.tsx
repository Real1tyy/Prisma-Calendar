import { Notice } from "obsidian";
import type { ChangeEvent } from "react";
import { useCallback, useRef, useState } from "react";

import { Button } from "../../components/button";
import { Textarea } from "../../components/textarea";
import { downloadTransferFile } from "./download-file";

export type TransferMode = "export" | "import";

export const DEFAULT_TRANSFER_STRINGS = {
	exportTitle: "Export settings",
	importTitle: "Import settings",
	exportDescription: "Only settings changed from defaults are included.",
	importDescription: "Paste or edit JSON below. Settings not included are reset to defaults.",
	copyButton: "Copy to clipboard",
	downloadButton: "Download",
	importFromFileButton: "Import from file",
	applyImportButton: "Import",
	closeButton: "Close",
	copySuccess: "Settings copied to clipboard.",
	downloadSuccess: "Settings exported.",
	importSuccess: "Settings imported.",
	importError: "Failed to import settings: {message}",
	fileReadError: "Could not read file: {message}",
	copyError: "Copy failed: {message}",
} satisfies Record<string, string>;

export type SettingsTransferStrings = typeof DEFAULT_TRANSFER_STRINGS;

export interface TransferPanelProps {
	mode: TransferMode;
	initialJson: string;
	filename: string;
	strings: SettingsTransferStrings;
	onImport: (parsed: unknown) => Promise<void>;
	close: () => void;
	testIdPrefix?: string | undefined;
}

function format(template: string, message: string): string {
	return template.replace("{message}", message);
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function TransferPanel({
	mode,
	initialJson,
	filename,
	strings,
	onImport,
	close,
	testIdPrefix,
}: TransferPanelProps) {
	const [value, setValue] = useState(initialJson);
	const [isBusy, setIsBusy] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const tid = (suffix: string): string => (testIdPrefix ? `${testIdPrefix}-${suffix}` : suffix);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			new Notice(strings.copySuccess);
		} catch (err) {
			new Notice(format(strings.copyError, errorMessage(err)));
		}
	}, [value, strings]);

	const handleDownload = useCallback(() => {
		downloadTransferFile(value, filename);
		new Notice(strings.downloadSuccess);
	}, [value, filename, strings]);

	const handlePickFile = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;
			setIsBusy(true);
			try {
				setValue(await file.text());
			} catch (err) {
				new Notice(format(strings.fileReadError, errorMessage(err)));
			} finally {
				if (fileInputRef.current) fileInputRef.current.value = "";
				setIsBusy(false);
			}
		},
		[strings]
	);

	const handleImport = useCallback(async () => {
		setIsBusy(true);
		try {
			const parsed = JSON.parse(value) as unknown;
			await onImport(parsed);
			new Notice(strings.importSuccess);
			close();
		} catch (err) {
			new Notice(format(strings.importError, errorMessage(err)));
		} finally {
			setIsBusy(false);
		}
	}, [value, onImport, close, strings]);

	const description = mode === "export" ? strings.exportDescription : strings.importDescription;

	return (
		<div className="settings-transfer-panel">
			<p className="settings-transfer-description">{description}</p>
			<Textarea
				testId={tid("editor")}
				className="settings-transfer-editor"
				value={value}
				onChange={setValue}
				spellCheck={false}
				rows={14}
			/>
			<div className="settings-transfer-actions">
				{mode === "export" ? (
					<>
						<Button testId={tid("download")} variant="primary" onClick={handleDownload}>
							{strings.downloadButton}
						</Button>
						<Button testId={tid("copy")} onClick={handleCopy}>
							{strings.copyButton}
						</Button>
					</>
				) : (
					<>
						<Button testId={tid("pick-file")} onClick={handlePickFile} disabled={isBusy}>
							{strings.importFromFileButton}
						</Button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".json,application/json,text/json"
							style={{ display: "none" }}
							onChange={handleFileChange}
							data-testid={tid("file-input")}
						/>
						<Button testId={tid("apply")} variant="primary" onClick={handleImport} disabled={isBusy}>
							{strings.applyImportButton}
						</Button>
					</>
				)}
				<Button testId={tid("close")} onClick={close}>
					{strings.closeButton}
				</Button>
			</div>
		</div>
	);
}
