import type { App } from "obsidian";
import { memo } from "react";

import { Button } from "../components/button";
import { ModalDescription } from "../components/modal-description";
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
			{message && <ModalDescription>{message}</ModalDescription>}
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
				<Button testId={`${testIdPrefix}confirmation-modal-cancel`} onClick={onCancel}>
					{cancelLabel}
				</Button>
				<Button
					testId={`${testIdPrefix}confirmation-modal-confirm`}
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
	onConfirm?: () => void;
	onCancel?: () => void;
}

export function openConfirmation(app: App, options: OpenConfirmationOptions): Promise<boolean> {
	const { onConfirm, onCancel, testIdPrefix: testIdPrefixOpt, ...rest } = options;
	const testIdPrefix = testIdPrefixOpt ?? "";
	return openReactModal<boolean>({
		app,
		title: rest.title,
		testId: `${testIdPrefix}confirmation-modal-container`,
		render: (submit, cancel) => (
			<ConfirmationModalContent
				{...rest}
				testIdPrefix={testIdPrefix}
				onConfirm={() => {
					onConfirm?.();
					submit(true);
				}}
				onCancel={() => {
					onCancel?.();
					cancel();
				}}
			/>
		),
	}).then((result) => result ?? false);
}
