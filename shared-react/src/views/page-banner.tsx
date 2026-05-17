import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";

import { ObsidianIcon } from "../primitives/atoms/obsidian-icon";
import { useScoped } from "../contexts/theme-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { buildPageBannerStyles } from "./page-banner.styles";

export interface PageBannerAction {
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
	actions: PageBannerAction[];
}

export const ActionBar = memo(function ActionBar({ actions }: ActionBarProps) {
	const { cls, tid } = useScoped("page-banner");
	return (
		<div className={cls("actions")} role="toolbar" aria-label="Page actions">
			{actions.map((action) => (
				<button
					key={action.id}
					type="button"
					className={`${cls("action-btn")} clickable-icon`}
					onClick={action.onClick}
					disabled={action.disabled}
					title={action.tooltip ?? action.label}
					aria-label={action.label}
					data-testid={tid("action", action.id)}
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
}

export const BackButton = memo(function BackButton({ onClick }: BackButtonProps) {
	const { cls, tid } = useScoped("page-banner");
	return (
		<button
			type="button"
			className={`${cls("back")} clickable-icon`}
			onClick={onClick}
			aria-label="Go back"
			data-testid={tid("back")}
		>
			<ObsidianIcon icon="arrow-left" />
		</button>
	);
});

// ─── PageBanner ───

export interface PageBannerProps {
	title: string;
	subtitle?: string | undefined;
	actions?: PageBannerAction[] | undefined;
	onBack?: (() => void) | undefined;
	breadcrumbs?: BreadcrumbItem[] | undefined;
	right?: ReactNode;
}

export const PageBanner = memo(function PageBanner({
	title,
	subtitle,
	actions,
	onBack,
	breadcrumbs,
	right,
}: PageBannerProps) {
	const { cls, tid } = useScopedStyles("page-banner", buildPageBannerStyles);
	const handleBack = useCallback(() => onBack?.(), [onBack]);

	const memoizedActions = useMemo(
		() => (actions && actions.length > 0 ? <ActionBar actions={actions} /> : null),
		[actions]
	);

	return (
		<div className={cls()} role="banner">
			{breadcrumbs && breadcrumbs.length > 0 && (
				<nav className={cls("breadcrumbs")} aria-label="Breadcrumbs">
					{breadcrumbs.map((crumb, i) => (
						<span key={i} className={cls("breadcrumb")}>
							{crumb.onClick ? (
								<button type="button" className={cls("breadcrumb-link")} onClick={crumb.onClick}>
									{crumb.label}
								</button>
							) : (
								<span>{crumb.label}</span>
							)}
							{i < breadcrumbs.length - 1 && <span className={cls("breadcrumb-separator")}>/</span>}
						</span>
					))}
				</nav>
			)}
			<div className={cls("row")}>
				{onBack && <BackButton onClick={handleBack} />}
				<div className={cls("title-group")}>
					<h2 className={cls("title")} data-testid={tid("title")}>
						{title}
					</h2>
					{subtitle && <span className={cls("subtitle")}>{subtitle}</span>}
				</div>
				{memoizedActions}
				{right && <div className={cls("right")}>{right}</div>}
			</div>
		</div>
	);
});
