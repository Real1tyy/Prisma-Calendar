import { buildCollapsibleStyles, LocalKV } from "@real1ty/obsidian-plugins";
import { memo, useCallback, useState, type ReactNode } from "react";
import { z } from "zod";

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

// ─── Persisted collapse state ───

const COLLAPSED_NAMESPACE = "obsidian-plugins:collapsible";
const CollapsedSchema = z.boolean();

// `LocalKV`'s constructor resolves `window.localStorage`, so the store is built on
// first use rather than at module scope — importing this file must stay safe in a
// non-DOM environment.
let collapsedStore: LocalKV<boolean> | undefined;
const collapsedKV = (): LocalKV<boolean> =>
	(collapsedStore ??= new LocalKV<boolean>({ namespace: COLLAPSED_NAMESPACE, schema: CollapsedSchema }));

/**
 * Uncontrolled collapsed state, optionally persisted per device under `storageKey`.
 * `LocalKV` validates on read, so a corrupt or wrong-typed entry reads back as absent
 * and degrades to `defaultCollapsed` instead of throwing.
 */
function usePersistedCollapsed(
	storageKey: string | undefined,
	defaultCollapsed: boolean
): readonly [boolean, (next: boolean) => void] {
	const [collapsed, setCollapsed] = useState(() =>
		storageKey === undefined ? defaultCollapsed : (collapsedKV().get(storageKey) ?? defaultCollapsed)
	);

	const update = useCallback(
		(next: boolean) => {
			setCollapsed(next);
			if (storageKey !== undefined) collapsedKV().set(storageKey, next);
		},
		[storageKey]
	);

	return [collapsed, update] as const;
}

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
	/**
	 * Uncontrolled mode: remembers the collapsed flag in this device's `localStorage`
	 * under this key and seeds the initial state from it, falling back to
	 * `defaultCollapsed` when nothing valid is stored. Ignored when `collapsed` is
	 * provided. Every plugin shares one storage origin, so qualify the key per plugin.
	 */
	storageKey?: string;
	/** Optional slug used to stamp data-testid attributes on the section, header, body, and toggle. */
	testIdSlug?: string;
}

/**
 * Expandable section with a clickable header. Works controlled
 * (`collapsed` + `onToggle`) when the parent owns the state, or uncontrolled with
 * `defaultCollapsed` — optionally remembering the user's choice per device via
 * `storageKey`.
 */
export const CollapsibleSection = memo(function CollapsibleSection({
	label,
	children,
	actions,
	collapsed: controlledCollapsed,
	onToggle,
	defaultCollapsed = false,
	storageKey,
	testIdSlug,
}: CollapsibleSectionProps) {
	const { cls, tid } = useScopedStyles("collapsible", buildCollapsibleStyles);

	const [uncontrolledCollapsed, setUncontrolledCollapsed] = usePersistedCollapsed(storageKey, defaultCollapsed);
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
