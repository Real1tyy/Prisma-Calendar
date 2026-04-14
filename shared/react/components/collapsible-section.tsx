import type { ReactNode } from "react";
import { memo, useState } from "react";

import { buildCollapsibleStyles } from "../../components/primitives/collapsible-section";
import { useActivatable } from "../hooks/use-activatable";
import { useInjectedStyles } from "../hooks/use-injected-styles";

// ─── SectionHeader ───

export interface SectionHeaderProps {
	label: string;
	collapsed: boolean;
	onToggle: () => void;
	actions?: ReactNode;
	cssPrefix: string;
}

export const SectionHeader = memo(function SectionHeader({
	label,
	collapsed,
	onToggle,
	actions,
	cssPrefix,
}: SectionHeaderProps) {
	const activate = useActivatable(onToggle);

	return (
		<div {...activate} className={`${cssPrefix}collapsible-header`} role="button" aria-expanded={!collapsed}>
			<span className={`${cssPrefix}collapsible-toggle`}>{collapsed ? "▶" : "▼"}</span>
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
}

export const SectionBody = memo(function SectionBody({ collapsed, children, cssPrefix }: SectionBodyProps) {
	const hiddenClass = collapsed ? ` ${cssPrefix}collapsible-hidden` : "";
	return <div className={`${cssPrefix}collapsible-body${hiddenClass}`}>{children}</div>;
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
}: CollapsibleSectionProps) {
	useInjectedStyles(`${cssPrefix}collapsible-styles`, buildCollapsibleStyles(cssPrefix));

	const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
	const collapsed = controlledCollapsed ?? uncontrolledCollapsed;

	const handleToggle = () => {
		const next = !collapsed;
		if (controlledCollapsed === undefined) setUncontrolledCollapsed(next);
		onToggle?.(next);
	};

	return (
		<div className={`${cssPrefix}collapsible`}>
			<SectionHeader
				label={label}
				collapsed={collapsed}
				onToggle={handleToggle}
				actions={actions}
				cssPrefix={cssPrefix}
			/>
			<SectionBody collapsed={collapsed} cssPrefix={cssPrefix}>
				{children}
			</SectionBody>
		</div>
	);
});
