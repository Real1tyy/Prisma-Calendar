import type { App } from "obsidian";
import type { KeyboardEvent } from "react";
import { memo, useCallback, useRef, useState } from "react";

import { Button } from "../components/button";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { openReactModal } from "../show-react-modal";

function buildRenameStyles(p: string): string {
	return `
.${p}rename-input {
	width: 100%; padding: 8px 12px; font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background: var(--background-secondary); color: var(--text-normal); margin-bottom: 12px;
}
.${p}rename-input:focus { border-color: var(--interactive-accent); outline: none; }
`;
}

export interface RenameModalProps {
	initialValue: string;
	validationPattern?: RegExp | undefined;
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

export const RenameModalContent = memo(function RenameModalContent({
	initialValue,
	validationPattern,
	cssPrefix = "",
	testIdPrefix = "",
	onSubmit,
	onCancel,
}: RenameModalProps) {
	useInjectedStyles(`${cssPrefix}rename-styles`, buildRenameStyles(cssPrefix));
	const [value, setValue] = useState(initialValue);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = useCallback(() => {
		const trimmed = value.trim();
		if (!trimmed) return;
		if (validationPattern && !validationPattern.test(trimmed)) return;
		onSubmit(trimmed);
	}, [value, validationPattern, onSubmit]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				handleSubmit();
			}
		},
		[handleSubmit]
	);

	return (
		<div data-testid={`${testIdPrefix}rename-modal`}>
			<input
				ref={inputRef}
				type="text"
				className={`${cssPrefix}rename-input`}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				data-testid={`${testIdPrefix}rename-input`}
				autoFocus
			/>
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "12px" }}>
				<Button testId={`${testIdPrefix}rename-cancel`} onClick={onCancel}>
					Cancel
				</Button>
				<Button testId={`${testIdPrefix}rename-submit`} onClick={handleSubmit} variant="primary">
					Save
				</Button>
			</div>
		</div>
	);
});

export interface OpenRenameOptions {
	title?: string;
	initialValue: string;
	validationPattern?: RegExp;
	cssPrefix?: string;
	testIdPrefix?: string;
}

export function openRenameModal(app: App, options: OpenRenameOptions): Promise<string | null> {
	const testIdPrefix = options.testIdPrefix ?? "";
	return openReactModal<string>({
		app,
		title: options.title ?? "Rename",
		testId: `${testIdPrefix}rename-modal-container`,
		render: (submit, cancel) => (
			<RenameModalContent
				initialValue={options.initialValue}
				validationPattern={options.validationPattern}
				cssPrefix={options.cssPrefix}
				testIdPrefix={testIdPrefix}
				onSubmit={submit}
				onCancel={cancel}
			/>
		),
	});
}
