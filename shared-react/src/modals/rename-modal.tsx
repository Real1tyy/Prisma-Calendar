import type { App } from "obsidian";
import type { KeyboardEvent, ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../components/button";
import { ModalDescription } from "../components/modal-description";
import { useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { openReactModal } from "../show-react-modal";
import { buildRenameStyles } from "./rename-modal.styles";

export interface RenameModalProps {
	initialValue: string;
	validationPattern?: RegExp | undefined;
	description?: ReactNode | undefined;
	extras?: ReactNode | undefined;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

function isValidValue(value: string, validationPattern: RegExp | undefined): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (!validationPattern) return true;
	validationPattern.lastIndex = 0;
	return validationPattern.test(trimmed);
}

export const RenameModalContent = memo(function RenameModalContent({
	initialValue,
	validationPattern,
	description,
	extras,
	onSubmit,
	onCancel,
}: RenameModalProps) {
	const { cls, tid, cssPrefix } = useScoped("rename");
	useInjectedStyles(`${cssPrefix}rename-styles`, buildRenameStyles(cssPrefix));
	const [value, setValue] = useState(initialValue);
	const inputRef = useRef<HTMLInputElement>(null);
	const settledRef = useRef(false);

	const canSubmit = useMemo(() => isValidValue(value, validationPattern), [value, validationPattern]);

	useEffect(() => {
		const id = requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
		return () => cancelAnimationFrame(id);
	}, []);

	const handleSubmit = useCallback(() => {
		if (!canSubmit || settledRef.current) return;
		settledRef.current = true;
		onSubmit(value.trim());
	}, [canSubmit, value, onSubmit]);

	const handleCancel = useCallback(() => {
		if (settledRef.current) return;
		settledRef.current = true;
		onCancel();
	}, [onCancel]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.nativeEvent.isComposing) return;
			if (e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				handleSubmit();
			}
		},
		[handleSubmit]
	);

	return (
		<div data-testid={tid("modal")}>
			{description ? <ModalDescription>{description}</ModalDescription> : null}
			<input
				ref={inputRef}
				type="text"
				className={cls("input")}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				data-testid={tid("input")}
			/>
			{extras}
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "12px" }}>
				<Button testId={tid("cancel")} onClick={handleCancel}>
					Cancel
				</Button>
				<Button testId={tid("submit")} onClick={handleSubmit} variant="primary" disabled={!canSubmit}>
					Save
				</Button>
			</div>
		</div>
	);
});

interface BaseOpenRenameOptions {
	title?: string;
	initialValue: string;
	validationPattern?: RegExp;
	description?: ReactNode;
	/** CSS prefix for the modal subtree. Propagated to `SharedReactThemeProvider`. */
	cssPrefix?: string;
	/** TestId prefix for the modal subtree. Propagated to `SharedReactThemeProvider`. */
	testIdPrefix?: string;
	onCancel?: () => void;
}

export type OpenRenameOptions<TExtras = undefined> =
	| (BaseOpenRenameOptions & {
			initialExtras?: undefined;
			renderExtras?: undefined;
			onSubmit?: (value: string) => void;
	  })
	| (BaseOpenRenameOptions & {
			initialExtras: TExtras;
			renderExtras: (state: TExtras, setState: (next: TExtras) => void) => ReactNode;
			onSubmit?: (value: string, extras: TExtras) => void;
	  });

export interface RenameModalResult<TExtras = undefined> {
	value: string;
	extras: TExtras;
}

export function openRenameModal<TExtras = undefined>(
	app: App,
	options: OpenRenameOptions<TExtras>
): Promise<RenameModalResult<TExtras> | null> {
	const testIdPrefix = options.testIdPrefix ?? options.cssPrefix ?? "";
	return openReactModal<RenameModalResult<TExtras>>({
		app,
		title: options.title ?? "Rename",
		testId: `${testIdPrefix}rename-modal-container`,
		...(options.cssPrefix !== undefined ? { cssPrefix: options.cssPrefix } : {}),
		testIdPrefix,
		render: (submit, cancel) => (
			<RenameShell<TExtras>
				options={options}
				onSubmit={(result) => {
					(options.onSubmit as ((value: string, extras: TExtras) => void) | undefined)?.(result.value, result.extras);
					submit(result);
				}}
				onCancel={() => {
					options.onCancel?.();
					cancel();
				}}
			/>
		),
	});
}

interface RenameShellProps<TExtras> {
	options: OpenRenameOptions<TExtras>;
	onSubmit: (result: RenameModalResult<TExtras>) => void;
	onCancel: () => void;
}

function RenameShell<TExtras>({ options, onSubmit, onCancel }: RenameShellProps<TExtras>) {
	const [extras, setExtras] = useState<TExtras>(options.initialExtras as TExtras);
	return (
		<RenameModalContent
			initialValue={options.initialValue}
			validationPattern={options.validationPattern}
			description={options.description}
			extras={options.renderExtras?.(extras, setExtras)}
			onSubmit={(value) => onSubmit({ value, extras })}
			onCancel={onCancel}
		/>
	);
}
