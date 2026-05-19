import type { App } from "obsidian";
import { memo, type ReactNode } from "react";

import { SettingItem } from "../../primitives/layout/setting-item";
import { ResetToDefaultsButton } from "./reset-to-defaults-button";

const TOGGLE_LABEL = "Show settings button";

export interface ManagerToolbarProps {
	app: App;
	cssPrefix: string;
	/** Row-prefix sub-namespace (e.g. `action-manager`). Drives toolbar testid + classes. */
	rowPrefix: string;
	/** Toggle control rendered inside the "Show settings button" `SettingItem`. */
	toggleControl: ReactNode;
	onReset: () => void;
	confirmMessage: string;
}

export const ManagerToolbar = memo(function ManagerToolbar({
	app,
	cssPrefix,
	rowPrefix,
	toggleControl,
	onReset,
	confirmMessage,
}: ManagerToolbarProps) {
	const toolbarTid = `${cssPrefix}${rowPrefix}-toolbar`;
	return (
		<div className={toolbarTid} data-testid={toolbarTid}>
			<SettingItem name={TOGGLE_LABEL}>{toggleControl}</SettingItem>
			<ResetToDefaultsButton
				app={app}
				cssPrefix={cssPrefix}
				onReset={onReset}
				testId={`${cssPrefix}${rowPrefix}-reset`}
				confirmMessage={confirmMessage}
			/>
		</div>
	);
});
