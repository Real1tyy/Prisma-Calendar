import { setIcon } from "obsidian";
import type { CSSProperties } from "react";
import { memo, useCallback, useEffect, useRef } from "react";

import { useExternalSnapshot } from "../hooks/use-external-snapshot";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { DEFAULT_COLOR_SENTINEL } from "./constants";
import type { PageHeaderStore } from "./store";
import { buildPageHeaderStyles } from "./styles";

export interface ActionBarProps {
	store: PageHeaderStore;
	cssPrefix: string;
	editable: boolean;
	onActionClick: (id: string) => void;
	onSettingsClick: () => void;
}

interface ActionButtonProps {
	icon: string | undefined;
	label: string;
	className: string;
	testId: string;
	style?: CSSProperties;
	onClick: () => void;
}

const ActionButton = memo(function ActionButton({ icon, label, className, testId, style, onClick }: ActionButtonProps) {
	const ref = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.replaceChildren();
		if (icon) setIcon(el, icon);
	}, [icon]);

	return (
		<button
			ref={ref}
			type="button"
			className={className}
			aria-label={label}
			data-testid={testId}
			style={style}
			onClick={onClick}
		/>
	);
});

function resolveColorStyle(color: string | undefined): CSSProperties | undefined {
	return color && color !== DEFAULT_COLOR_SENTINEL ? { color } : undefined;
}

export const PageHeaderActionBar = memo(function PageHeaderActionBar({
	store,
	cssPrefix,
	editable,
	onActionClick,
	onSettingsClick,
}: ActionBarProps) {
	useInjectedStyles(`${cssPrefix}page-header-styles`, buildPageHeaderStyles(cssPrefix));
	const snapshot = useExternalSnapshot(store);

	const handleSettings = useCallback(() => onSettingsClick(), [onSettingsClick]);

	return (
		<div className={`${cssPrefix}page-header-actions`} role="toolbar">
			{snapshot.visibleActions.map((action) => {
				const label = snapshot.renames[action.id] ?? action.label;
				const icon = snapshot.iconOverrides[action.id] ?? action.icon;
				const color = snapshot.colorOverrides[action.id] ?? action.color;
				const style = resolveColorStyle(color);

				return (
					<ActionButton
						key={action.id}
						icon={icon}
						label={label}
						className={`clickable-icon view-action ${cssPrefix}header-btn`}
						testId={`${cssPrefix}toolbar-${action.id}`}
						{...(style ? { style } : {})}
						onClick={() => onActionClick(action.id)}
					/>
				);
			})}
			{editable && snapshot.showSettingsButton && (
				<ActionButton
					icon="settings-2"
					label="Manage Header Actions"
					className={`clickable-icon view-action ${cssPrefix}header-btn ${cssPrefix}header-settings`}
					testId={`${cssPrefix}page-header-manage`}
					onClick={handleSettings}
				/>
			)}
		</div>
	);
});
