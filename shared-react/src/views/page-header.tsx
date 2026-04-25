import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";

import { ObsidianIcon } from "../components/obsidian-icon";
import { useInjectedStyles } from "../hooks/use-injected-styles";

function buildPageHeaderStyles(p: string): string {
	return `
.${p}page-header { margin-bottom: 16px; }
.${p}page-header-row { display: flex; align-items: center; gap: 8px; }
.${p}page-header-title-group { flex: 1; min-width: 0; }
.${p}page-header-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--text-normal); }
.${p}page-header-subtitle { font-size: var(--font-ui-small); color: var(--text-muted); margin-top: 2px; }
.${p}page-header-actions { display: flex; gap: 4px; flex-shrink: 0; }
.${p}page-header-action-btn svg { width: 16px; height: 16px; }
.${p}page-header-back { flex-shrink: 0; }
.${p}page-header-back svg { width: 16px; height: 16px; }
.${p}page-header-right { flex-shrink: 0; margin-left: auto; }
.${p}page-header-breadcrumbs {
	display: flex; align-items: center; gap: 4px; margin-bottom: 8px;
	font-size: var(--font-ui-smaller); color: var(--text-muted);
}
.${p}page-header-breadcrumb { display: inline-flex; align-items: center; gap: 4px; }
.${p}page-header-breadcrumb-link {
	background: none; border: none; padding: 0; cursor: pointer;
	color: var(--text-accent); font-size: inherit;
}
.${p}page-header-breadcrumb-link:hover { text-decoration: underline; }
.${p}page-header-breadcrumb-separator { color: var(--text-faint); }
`;
}

export interface PageHeaderAction {
	id: string;
	icon: string;
	label: string;
	onClick: () => void;
	disabled?: boolean | undefined;
	tooltip?: string | undefined;
	color?: string | undefined;
}

export interface BreadcrumbItem {
	label: string;
	onClick?: (() => void) | undefined;
}

// ─── ActionBar ───

export interface ActionBarProps {
	actions: PageHeaderAction[];
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
}

export const ActionBar = memo(function ActionBar({ actions, cssPrefix = "", testIdPrefix }: ActionBarProps) {
	return (
		<div className={`${cssPrefix}page-header-actions`} role="toolbar" aria-label="Page actions">
			{actions.map((action) => (
				<button
					key={action.id}
					type="button"
					className={`${cssPrefix}page-header-action-btn clickable-icon`}
					onClick={action.onClick}
					disabled={action.disabled}
					title={action.tooltip ?? action.label}
					aria-label={action.label}
					data-testid={testIdPrefix ? `${testIdPrefix}page-header-action-${action.id}` : undefined}
					style={action.color ? { color: action.color } : undefined}
				>
					<ObsidianIcon icon={action.icon} />
				</button>
			))}
		</div>
	);
});

// ─── BackButton ───

export interface BackButtonProps {
	onClick: () => void;
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
}

export const BackButton = memo(function BackButton({ onClick, cssPrefix = "", testIdPrefix }: BackButtonProps) {
	return (
		<button
			type="button"
			className={`${cssPrefix}page-header-back clickable-icon`}
			onClick={onClick}
			aria-label="Go back"
			data-testid={testIdPrefix ? `${testIdPrefix}page-header-back` : undefined}
		>
			<ObsidianIcon icon="arrow-left" />
		</button>
	);
});

// ─── PageHeader ───

export interface PageHeaderProps {
	title: string;
	subtitle?: string | undefined;
	actions?: PageHeaderAction[] | undefined;
	onBack?: (() => void) | undefined;
	breadcrumbs?: BreadcrumbItem[] | undefined;
	right?: ReactNode;
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
}

export const PageHeader = memo(function PageHeader({
	title,
	subtitle,
	actions,
	onBack,
	breadcrumbs,
	right,
	cssPrefix = "",
	testIdPrefix,
}: PageHeaderProps) {
	useInjectedStyles(`${cssPrefix}page-header-styles`, buildPageHeaderStyles(cssPrefix));
	const handleBack = useCallback(() => onBack?.(), [onBack]);

	const memoizedActions = useMemo(
		() =>
			actions && actions.length > 0 ? (
				<ActionBar actions={actions} cssPrefix={cssPrefix} testIdPrefix={testIdPrefix} />
			) : null,
		[actions, cssPrefix, testIdPrefix]
	);

	return (
		<div className={`${cssPrefix}page-header`} role="banner">
			{breadcrumbs && breadcrumbs.length > 0 && (
				<nav className={`${cssPrefix}page-header-breadcrumbs`} aria-label="Breadcrumbs">
					{breadcrumbs.map((crumb, i) => (
						<span key={i} className={`${cssPrefix}page-header-breadcrumb`}>
							{crumb.onClick ? (
								<button type="button" className={`${cssPrefix}page-header-breadcrumb-link`} onClick={crumb.onClick}>
									{crumb.label}
								</button>
							) : (
								<span>{crumb.label}</span>
							)}
							{i < breadcrumbs.length - 1 && <span className={`${cssPrefix}page-header-breadcrumb-separator`}>/</span>}
						</span>
					))}
				</nav>
			)}
			<div className={`${cssPrefix}page-header-row`}>
				{onBack && <BackButton onClick={handleBack} cssPrefix={cssPrefix} testIdPrefix={testIdPrefix} />}
				<div className={`${cssPrefix}page-header-title-group`}>
					<h2
						className={`${cssPrefix}page-header-title`}
						data-testid={testIdPrefix ? `${testIdPrefix}page-header-title` : undefined}
					>
						{title}
					</h2>
					{subtitle && <span className={`${cssPrefix}page-header-subtitle`}>{subtitle}</span>}
				</div>
				{memoizedActions}
				{right && <div className={`${cssPrefix}page-header-right`}>{right}</div>}
			</div>
		</div>
	);
});
