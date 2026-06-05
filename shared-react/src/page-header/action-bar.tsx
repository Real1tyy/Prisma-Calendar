import { setIcon } from "obsidian";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";

import { useExternalSnapshot } from "../hooks/reactive/use-external-snapshot";
import { useInjectedStyles } from "../hooks/styles/use-styles";
import { DEFAULT_COLOR_SENTINEL } from "./constants";
import type { PageHeaderStore } from "./store";
import { buildPageHeaderStyles } from "./styles";

// Gap (px) kept between the cluster's left edge and the header content to its left
// (the title) so trimmed rows never crowd against it.
const ACTION_FIT_SAFETY_PX = 16;
// Marker attribute toggled imperatively on overflowing buttons; CSS hides it (see
// styles.ts). Imperative (not React state) so re-measuring on resize can show every
// button to read its true position without a render round-trip.
const OVERFLOW_ATTR = "data-ph-overflow";

/**
 * Hide the trailing action buttons that don't fit, keeping the first ones (in the
 * configured order) and the right-anchored Manage button visible.
 *
 * The cluster is right-anchored inside `.view-actions` (Manage pinned to the header's
 * right edge, so it's always reachable). When the buttons don't fit, the overflow
 * therefore shows up on the LEFT — the first action spills past the cluster's left
 * boundary, over the title and off-screen. So we detect overflow by position: hide
 * trailing actions (nearest Manage, i.e. last in configured order) one at a time,
 * which lets the right-anchored cluster pull rightward, until the first visible
 * action clears the boundary. Re-measuring each step is required because hiding a
 * button lets the title reclaim space and shifts the boundary. Reading true screen
 * positions (rather than computing a count from a width) is correct regardless of how
 * Obsidian distributes header flex space — the width math is unreliable because the
 * title is starved to near-zero while every button is shown. Returns early (full row
 * shown) before layout (jsdom in tests).
 *
 * `revision` must change when the visible action set OR its order changes, so a
 * reorder that brings a previously-overflowed action into the visible range
 * re-packs and reveals it.
 */
function usePackActionRow(
	containerRef: React.RefObject<HTMLDivElement | null>,
	cssPrefix: string,
	revision: string
): void {
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const header = container.closest(".view-header");
		const viewActions = container.closest(".view-actions");

		const pack = (): void => {
			const actionBtns = Array.from(container.querySelectorAll<HTMLElement>(`[data-testid^="${cssPrefix}toolbar-"]`));
			// Show everything first so the measurement reflects the untrimmed row.
			for (const btn of actionBtns) btn.removeAttribute(OVERFLOW_ATTR);
			if (!header || actionBtns.length === 0) return;
			if (header.getBoundingClientRect().width <= 0) return; // not laid out yet (jsdom)

			// Left edge the cluster may not cross — the right edge of the header content
			// before it (the title sits just left of `.view-actions`), plus a small gap.
			const leftBoundary = (): number => (viewActions ?? header).getBoundingClientRect().left + ACTION_FIT_SAFETY_PX;
			const firstVisibleLeft = (): number | null => {
				const fv = actionBtns.find((b) => b.getAttribute(OVERFLOW_ATTR) !== "true");
				return fv ? fv.getBoundingClientRect().left : null;
			};

			// Hiding the trailing action shrinks the right-anchored cluster, pulling the
			// first one rightward; stop as soon as it clears the boundary.
			for (let i = actionBtns.length - 1; i >= 0; i--) {
				const left = firstVisibleLeft();
				if (left === null || left >= leftBoundary()) break;
				actionBtns[i].setAttribute(OVERFLOW_ATTR, "true");
			}
		};

		pack();
		if (typeof ResizeObserver === "undefined" || typeof requestAnimationFrame === "undefined") return;
		// Debounce to the next frame: pack() mutates layout, and running it straight
		// from the observer callback can trip "ResizeObserver loop" warnings.
		let frame = 0;
		const schedule = (): void => {
			if (frame) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(pack);
		};
		const observer = new ResizeObserver(schedule);
		if (header) observer.observe(header);
		if (viewActions) observer.observe(viewActions);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [containerRef, cssPrefix, revision]);
}

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
	const containerRef = useRef<HTMLDivElement>(null);

	const handleSettings = useCallback(() => onSettingsClick(), [onSettingsClick]);

	// Re-pack whenever the visible set, its ORDER, or the Manage button's presence
	// changes — so reordering a previously-overflowed action into the visible range
	// reveals it.
	const fitRevision = `${snapshot.visibleActions.map((a) => a.id).join("|")}::${
		editable && snapshot.showSettingsButton ? "m" : ""
	}`;
	usePackActionRow(containerRef, cssPrefix, fitRevision);

	return (
		<div ref={containerRef} className={`${cssPrefix}page-header-actions`} role="toolbar">
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
