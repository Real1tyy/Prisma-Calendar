import { Notice } from "obsidian";
import { useCallback, useRef, useState } from "react";

export interface UseCopyToClipboardOptions {
	/** Text shown in the Obsidian Notice on success. Defaults to `"Copied!"`. */
	successMessage?: string | undefined;
	/** Milliseconds to keep the `copied` flag true. Defaults to 1500. */
	feedbackMs?: number | undefined;
}

const DEFAULT_SUCCESS = "Copied!";
const DEFAULT_FEEDBACK_MS = 1500;

export function useCopyToClipboard(text: string, options?: UseCopyToClipboardOptions) {
	const [copied, setCopied] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(text);
			new Notice(options?.successMessage ?? DEFAULT_SUCCESS);
			setCopied(true);
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => setCopied(false), options?.feedbackMs ?? DEFAULT_FEEDBACK_MS);
		} catch {
			new Notice("Failed to copy");
		}
	}, [text, options?.successMessage, options?.feedbackMs]);

	return { copy, copied } as const;
}
