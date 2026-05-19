import type { App } from "obsidian";
import { memo, useCallback } from "react";

import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { openConfirmation } from "../../modals/confirmation-modal";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { testIdAttr } from "../../utils/test-id";

function buildResetButtonStyles(p: string): string {
	return `
.${p}reset-to-defaults-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	font-size: var(--font-ui-small);
	font-weight: 500;
	cursor: pointer;
	flex-shrink: 0;
}
.${p}reset-to-defaults-btn[disabled] {
	cursor: not-allowed;
	opacity: 0.5;
}
.${p}reset-to-defaults-btn svg {
	width: 14px;
	height: 14px;
}
`;
}

const DEFAULT_CONFIRM_TITLE = "Reset to defaults?";
const DEFAULT_CONFIRM_MESSAGE =
	"This restores the default order, visibility, labels, icons, and colors. Custom changes will be lost.";

export interface ResetToDefaultsButtonProps {
	app: App;
	onReset: () => void;
	cssPrefix: string;
	testId?: string;
	disabled?: boolean;
	confirmTitle?: string;
	confirmMessage?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	label?: string;
}

export const ResetToDefaultsButton = memo(function ResetToDefaultsButton({
	app,
	onReset,
	cssPrefix,
	testId,
	disabled = false,
	confirmTitle = DEFAULT_CONFIRM_TITLE,
	confirmMessage = DEFAULT_CONFIRM_MESSAGE,
	confirmLabel = "Reset",
	cancelLabel = "Cancel",
	label = "Reset to defaults",
}: ResetToDefaultsButtonProps) {
	useInjectedStyles(`${cssPrefix}reset-to-defaults-btn-styles`, buildResetButtonStyles(cssPrefix));

	const handleClick = useCallback(async () => {
		const result = await openConfirmation(app, {
			title: confirmTitle,
			message: confirmMessage,
			confirmLabel,
			cancelLabel,
			destructive: true,
			cssPrefix,
			testIdPrefix: `${cssPrefix}reset-to-defaults-`,
		});
		if (result !== null) onReset();
	}, [app, onReset, cssPrefix, confirmTitle, confirmMessage, confirmLabel, cancelLabel]);

	return (
		<button
			type="button"
			className={`${cssPrefix}reset-to-defaults-btn mod-warning`}
			onClick={handleClick}
			disabled={disabled}
			aria-label={label}
			title={label}
			{...testIdAttr(testId)}
		>
			<ObsidianIcon icon="rotate-ccw" />
			<span>{label}</span>
		</button>
	);
});
