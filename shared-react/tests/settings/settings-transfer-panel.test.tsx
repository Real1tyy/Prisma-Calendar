import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TRANSFER_STRINGS, TransferPanel } from "../../src/settings/settings-transfer/transfer-panel";
import { renderReact } from "../helpers/render-react";

const downloadSpy = vi.fn<(content: string, filename: string) => void>();

vi.mock("../../src/settings/settings-transfer/download-file", () => ({
	downloadTransferFile: (content: string, filename: string) => downloadSpy(content, filename),
}));

vi.mock("obsidian", () => ({
	Notice: class {
		constructor(public readonly message: string) {
			noticeMessages.push(message);
		}
	},
}));

const noticeMessages: string[] = [];

describe("TransferPanel", () => {
	beforeEach(() => {
		downloadSpy.mockClear();
		noticeMessages.length = 0;
	});

	it("renders the export description + buttons in export mode", () => {
		const close = vi.fn();
		const onImport = vi.fn();
		renderReact(
			<TransferPanel
				mode="export"
				initialJson='{"foo":1}'
				filename="settings.json"
				strings={DEFAULT_TRANSFER_STRINGS}
				close={close}
				onImport={onImport}
				testIdPrefix="t"
			/>
		);

		expect(screen.getByText(DEFAULT_TRANSFER_STRINGS.exportDescription)).toBeInTheDocument();
		expect(screen.getByTestId("t-download")).toBeInTheDocument();
		expect(screen.getByTestId("t-copy")).toBeInTheDocument();
		expect(screen.queryByTestId("t-apply")).toBeNull();
	});

	it("downloads the editor contents with the configured filename", async () => {
		const close = vi.fn();
		const onImport = vi.fn();
		const { user } = renderReact(
			<TransferPanel
				mode="export"
				initialJson='{"foo":1}'
				filename="my-settings.json"
				strings={DEFAULT_TRANSFER_STRINGS}
				close={close}
				onImport={onImport}
				testIdPrefix="t"
			/>
		);

		await user.click(screen.getByTestId("t-download"));
		expect(downloadSpy).toHaveBeenCalledWith('{"foo":1}', "my-settings.json");
		expect(noticeMessages).toContain(DEFAULT_TRANSFER_STRINGS.downloadSuccess);
	});

	it("lets the user edit the textarea before export", async () => {
		const close = vi.fn();
		const onImport = vi.fn();
		const { user } = renderReact(
			<TransferPanel
				mode="export"
				initialJson='{"foo":1}'
				filename="x.json"
				strings={DEFAULT_TRANSFER_STRINGS}
				close={close}
				onImport={onImport}
				testIdPrefix="t"
			/>
		);

		const editor = screen.getByTestId("t-editor") as HTMLTextAreaElement;
		fireEvent.change(editor, { target: { value: '{"edited":true}' } });
		await user.click(screen.getByTestId("t-download"));
		expect(downloadSpy).toHaveBeenCalledWith(expect.stringContaining('"edited":true'), "x.json");
	});

	it("invokes onImport with parsed JSON and closes on success", async () => {
		const close = vi.fn();
		const onImport = vi.fn().mockResolvedValue(undefined);
		const { user } = renderReact(
			<TransferPanel
				mode="import"
				initialJson=""
				filename="x.json"
				strings={DEFAULT_TRANSFER_STRINGS}
				close={close}
				onImport={onImport}
				testIdPrefix="t"
			/>
		);

		const editor = screen.getByTestId("t-editor") as HTMLTextAreaElement;
		fireEvent.change(editor, { target: { value: '{"enabled":false}' } });
		await user.click(screen.getByTestId("t-apply"));

		expect(onImport).toHaveBeenCalledWith({ enabled: false });
		expect(close).toHaveBeenCalledTimes(1);
		expect(noticeMessages).toContain(DEFAULT_TRANSFER_STRINGS.importSuccess);
	});

	it("surfaces JSON parse errors as a notice and does not call onImport", async () => {
		const close = vi.fn();
		const onImport = vi.fn();
		const { user } = renderReact(
			<TransferPanel
				mode="import"
				initialJson="not json"
				filename="x.json"
				strings={DEFAULT_TRANSFER_STRINGS}
				close={close}
				onImport={onImport}
				testIdPrefix="t"
			/>
		);

		await user.click(screen.getByTestId("t-apply"));
		expect(onImport).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
		expect(noticeMessages.some((m) => m.startsWith("Failed to import settings:"))).toBe(true);
	});

	it("clicking Close invokes the close callback", async () => {
		const close = vi.fn();
		const onImport = vi.fn();
		const { user } = renderReact(
			<TransferPanel
				mode="import"
				initialJson=""
				filename="x.json"
				strings={DEFAULT_TRANSFER_STRINGS}
				close={close}
				onImport={onImport}
				testIdPrefix="t"
			/>
		);

		await user.click(screen.getByTestId("t-close"));
		expect(close).toHaveBeenCalledTimes(1);
	});
});
