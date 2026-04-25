import type { App } from "obsidian";
import { memo } from "react";

import { Button } from "../components/button";
import { openReactModal } from "../show-react-modal";

export interface ConfirmationModalProps {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	testIdPrefix?: string | undefined;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmationModalContent = memo(function ConfirmationModalContent({
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	testIdPrefix = "",
	onConfirm,
	onCancel,
}: ConfirmationModalProps) {
	return (
		<div data-testid={`${testIdPrefix}confirmation-modal`}>
			{message && <p className="setting-item-description">{message}</p>}
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
				<Button testId={`${testIdPrefix}confirmation-cancel`} onClick={onCancel}>
					{cancelLabel}
				</Button>
				<Button
					testId={`${testIdPrefix}confirmation-confirm`}
					onClick={onConfirm}
					variant={destructive ? "warning" : "primary"}
				>
					{confirmLabel}
				</Button>
			</div>
		</div>
	);
});

export interface OpenConfirmationOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	testIdPrefix?: string;
}

export function openConfirmation(app: App, options: OpenConfirmationOptions): Promise<boolean> {
	const testIdPrefix = options.testIdPrefix ?? "";
	return openReactModal<boolean>({
		app,
		title: options.title,
		testId: `${testIdPrefix}confirmation-modal-container`,
		render: (submit, cancel) => (
			<ConfirmationModalContent
				{...options}
				testIdPrefix={testIdPrefix}
				onConfirm={() => submit(true)}
				onCancel={() => cancel()}
			/>
		),
	}).then((result) => result ?? false);
}
