import type { App } from "obsidian";
import { memo, useCallback, useRef, useState, type ReactNode } from "react";

import { useScopedTid } from "../contexts/theme-context";
import { Button } from "../primitives/atoms/button";
import { ModalDescription } from "../primitives/atoms/modal-description";
import { openReactModal } from "../show-react-modal";

export interface ConfirmationModalProps {
	title: string;
	message?: string | undefined;
	confirmLabel?: string | undefined;
	cancelLabel?: string | undefined;
	destructive?: boolean | undefined;
	extras?: ReactNode | undefined;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmationModalContent = memo(function ConfirmationModalContent({
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	extras,
	onConfirm,
	onCancel,
}: ConfirmationModalProps) {
	const tid = useScopedTid("confirmation-modal");
	const settledRef = useRef(false);

	const handleConfirm = useCallback(() => {
		if (settledRef.current) return;
		settledRef.current = true;
		onConfirm();
	}, [onConfirm]);

	const handleCancel = useCallback(() => {
		if (settledRef.current) return;
		settledRef.current = true;
		onCancel();
	}, [onCancel]);

	return (
		<div data-testid={tid()}>
			{message && <ModalDescription>{message}</ModalDescription>}
			{extras}
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
				<Button testId={tid("cancel")} onClick={handleCancel}>
					{cancelLabel}
				</Button>
				<Button testId={tid("confirm")} onClick={handleConfirm} variant={destructive ? "warning" : "primary"}>
					{confirmLabel}
				</Button>
			</div>
		</div>
	);
});

interface BaseOpenConfirmationOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	destructive?: boolean;
	/** TestId prefix for the modal subtree. Propagated to `SharedReactThemeProvider`. */
	testIdPrefix?: string;
	/** CSS prefix for the modal subtree. Propagated to `SharedReactThemeProvider`. */
	cssPrefix?: string;
	onCancel?: () => void;
}

export type OpenConfirmationOptions<TExtras = undefined> =
	| (BaseOpenConfirmationOptions & {
			initialExtras?: undefined;
			renderExtras?: undefined;
			onConfirm?: () => void;
	  })
	| (BaseOpenConfirmationOptions & {
			initialExtras: TExtras;
			renderExtras: (state: TExtras, setState: (next: TExtras) => void) => ReactNode;
			onConfirm?: (extras: TExtras) => void;
	  });

export interface ConfirmationResult<TExtras = undefined> {
	extras: TExtras;
}

export function openConfirmation<TExtras = undefined>(
	app: App,
	options: OpenConfirmationOptions<TExtras>
): Promise<ConfirmationResult<TExtras> | null> {
	const testIdPrefix = options.testIdPrefix ?? options.cssPrefix ?? "";
	return openReactModal<ConfirmationResult<TExtras>>({
		app,
		title: options.title,
		testId: `${testIdPrefix}confirmation-modal-container`,
		...(options.cssPrefix !== undefined ? { cssPrefix: options.cssPrefix } : {}),
		testIdPrefix,
		render: (submit, cancel) => (
			<ConfirmationShell<TExtras>
				options={options}
				onConfirm={(extras) => {
					(options.onConfirm as ((extras: TExtras) => void) | undefined)?.(extras);
					submit({ extras });
				}}
				onCancel={() => {
					options.onCancel?.();
					cancel();
				}}
			/>
		),
	});
}

interface ConfirmationShellProps<TExtras> {
	options: OpenConfirmationOptions<TExtras>;
	onConfirm: (extras: TExtras) => void;
	onCancel: () => void;
}

function ConfirmationShell<TExtras>({ options, onConfirm, onCancel }: ConfirmationShellProps<TExtras>) {
	const [extras, setExtras] = useState<TExtras>(options.initialExtras as TExtras);
	return (
		<ConfirmationModalContent
			title={options.title}
			message={options.message}
			confirmLabel={options.confirmLabel}
			cancelLabel={options.cancelLabel}
			destructive={options.destructive}
			extras={options.renderExtras?.(extras, setExtras)}
			onConfirm={() => onConfirm(extras)}
			onCancel={onCancel}
		/>
	);
}
