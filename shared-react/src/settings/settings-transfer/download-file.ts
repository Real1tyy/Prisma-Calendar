export function downloadTransferFile(content: string, filename: string): void {
	const blob = new Blob([content], { type: "application/json;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = activeDocument.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.hidden = true;
	activeDocument.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
