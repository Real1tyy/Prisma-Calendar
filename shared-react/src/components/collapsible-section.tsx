import { buildCollapsibleStyles } from "@real1ty-obsidian-plugins";
import type { ReactNode } from "react";
import { memo, useState } from "react";

import { useActivatable } from "../hooks/use-activatable";
import { useInjectedStyles } from "../hooks/use-injected-styles";

// ─── SectionHeader ───

export interface SectionHeaderProps {
	label: string;
	collapsed: boolean;
	onToggle: () => void;
	actions?: ReactNode;
	cssPrefix: string;
	/** Optional slug used to stamp data-testid attributes on header + toggle. */
	testIdSlug?: string;
}

export const SectionHeader = memo(function SectionHeader({
	label,
	collapsed,
	onToggle,
	actions,
	cssPrefix,
	testIdSlug,
}: SectionHeaderProps) {
	const activate = useActivatable(onToggle);

	return (
		<div
			{...activate}
			className={`${cssPrefix}collapsible-header`}
			role="button"
			aria-expanded={!collapsed}
			data-testid={testIdSlug ? `${cssPrefix}collapsible-header-${testIdSlug}` : undefined}
		>
			<span
				className={`${cssPrefix}collapsible-toggle`}
				data-testid={testIdSlug ? `${cssPrefix}collapsible-toggle-${testIdSlug}` : undefined}
			>
				{collapsed ? "▶" : "▼"}
			</span>
			<span className={`${cssPrefix}collapsible-label`}>{label}</span>
			{actions}
		</div>
	);
});

// ─── SectionBody ───

export interface SectionBodyProps {
	collapsed: boolean;
	children: ReactNode;
	cssPrefix: string;
	/** Optional slug used to stamp a data-testid attribute on the body. */
	testIdSlug?: string;
}

export const SectionBody = memo(function SectionBody({ collapsed, children, cssPrefix, testIdSlug }: SectionBodyProps) {
	const hiddenClass = collapsed ? ` ${cssPrefix}collapsible-hidden` : "";
	return (
		<div
			className={`${cssPrefix}collapsible-body${hiddenClass}`}
			data-testid={testIdSlug ? `${cssPrefix}collapsible-body-${testIdSlug}` : undefined}
		>
			{children}
		</div>
	);
});

// ─── CollapsibleSection ───

export interface CollapsibleSectionProps {
	label: string;
	children: ReactNode;
	cssPrefix: string;
	/** Optional slot rendered inside the header (e.g. action buttons). */
	actions?: ReactNode;
	/** Controlled mode: parent owns the collapsed state. */
	collapsed?: boolean;
	/** Controlled mode: fires when the user toggles via click/keyboard. */
	onToggle?: (next: boolean) => void;
	/** Uncontrolled initial value. Ignored when `collapsed` is provided. */
	defaultCollapsed?: boolean;
	/** Optional slug used to stamp data-testid attributes on the section, header, body, and toggle. */
	testIdSlug?: string;
}

/**
 * Expandable section with a clickable header. Works controlled
 * (`collapsed` + `onToggle`) for persisted state, or uncontrolled with
 * `defaultCollapsed` for local-only UI.
 */
export const CollapsibleSection = memo(function CollapsibleSection({
	label,
	children,
	cssPrefix,
	actions,
	collapsed: controlledCollapsed,
	onToggle,
	defaultCollapsed = false,
	testIdSlug,
}: CollapsibleSectionProps) {
	useInjectedStyles(`${cssPrefix}collapsible-styles`, buildCollapsibleStyles(cssPrefix));

	const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
	const collapsed = controlledCollapsed ?? uncontrolledCollapsed;

	const handleToggle = () => {
		const next = !collapsed;
		if (controlledCollapsed === undefined) setUncontrolledCollapsed(next);
		onToggle?.(next);
	};

	const slugProps = testIdSlug ? { testIdSlug } : {};

	return (
		<div
			className={`${cssPrefix}collapsible`}
			data-testid={testIdSlug ? `${cssPrefix}collapsible-${testIdSlug}` : undefined}
		>
			<SectionHeader
				label={label}
				collapsed={collapsed}
				onToggle={handleToggle}
				actions={actions}
				cssPrefix={cssPrefix}
				{...slugProps}
			/>
			<SectionBody collapsed={collapsed} cssPrefix={cssPrefix} {...slugProps}>
				{children}
			</SectionBody>
		</div>
	);
});
