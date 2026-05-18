import { buildCollapsibleStyles } from "@real1ty-obsidian-plugins";
import { memo, useState, type ReactNode } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useActivatable } from "../../hooks/interaction/use-activatable";
import { useScopedStyles } from "../../hooks/styles/use-styles";

// ─── SectionHeader ───

export interface SectionHeaderProps {
	label: string;
	collapsed: boolean;
	onToggle: () => void;
	actions?: ReactNode;
	/** Optional slug used to stamp data-testid attributes on header + toggle. */
	testIdSlug?: string;
}

export const SectionHeader = memo(function SectionHeader({
	label,
	collapsed,
	onToggle,
	actions,
	testIdSlug,
}: SectionHeaderProps) {
	const { cls, tid } = useScoped("collapsible");
	const activate = useActivatable(onToggle);

	return (
		<div
			{...activate}
			className={cls("header")}
			role="button"
			aria-expanded={!collapsed}
			data-testid={testIdSlug ? tid("header", testIdSlug) : undefined}
		>
			<span className={cls("toggle")} data-testid={testIdSlug ? tid("toggle", testIdSlug) : undefined}>
				{collapsed ? "▶" : "▼"}
			</span>
			<span className={cls("label")}>{label}</span>
			{actions ? (
				<span className={cls("actions")} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
					{actions}
				</span>
			) : null}
		</div>
	);
});

// ─── SectionBody ───

export interface SectionBodyProps {
	collapsed: boolean;
	children: ReactNode;
	/** Optional slug used to stamp a data-testid attribute on the body. */
	testIdSlug?: string;
}

export const SectionBody = memo(function SectionBody({ collapsed, children, testIdSlug }: SectionBodyProps) {
	const { cls, tid } = useScoped("collapsible");
	return (
		<div
			className={collapsed ? `${cls("body")} ${cls("hidden")}` : cls("body")}
			data-testid={testIdSlug ? tid("body", testIdSlug) : undefined}
		>
			{children}
		</div>
	);
});

// ─── CollapsibleSection ───

export interface CollapsibleSectionProps {
	label: string;
	children: ReactNode;
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
	actions,
	collapsed: controlledCollapsed,
	onToggle,
	defaultCollapsed = false,
	testIdSlug,
}: CollapsibleSectionProps) {
	const { cls, tid } = useScopedStyles("collapsible", buildCollapsibleStyles);

	const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
	const collapsed = controlledCollapsed ?? uncontrolledCollapsed;

	const handleToggle = () => {
		const next = !collapsed;
		if (controlledCollapsed === undefined) setUncontrolledCollapsed(next);
		onToggle?.(next);
	};

	return (
		<div className={cls()} data-testid={testIdSlug ? tid(testIdSlug) : undefined}>
			<SectionHeader
				label={label}
				collapsed={collapsed}
				onToggle={handleToggle}
				actions={actions}
				{...(testIdSlug ? { testIdSlug } : {})}
			/>
			<SectionBody collapsed={collapsed} {...(testIdSlug ? { testIdSlug } : {})}>
				{children}
			</SectionBody>
		</div>
	);
});
