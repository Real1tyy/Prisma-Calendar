import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	type Ref,
	type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { AppContext } from "../../contexts/app-context";
import { useDomEvent } from "../../hooks/dom/use-dom-event";
import { isTypingTarget } from "../../hooks/keyboard/is-typing-target";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { ContextMenu } from "../../menus/context-menu";
import type { ContextMenuItemDef } from "../../menus/types";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { appearanceStyle, type Appearance } from "../../utils/appearance";
import { cx } from "../../utils/cx";
import { GroupDropdown } from "./group-dropdown";
import { getActiveChild, type GroupChildState } from "./reorder";
import { buildTabbedContainerStyles } from "./styles";
import { TabManagerModal } from "./tab-manager-modal";
import {
	isGroupTab,
	type GroupTabDefinition,
	type TabbedContainerHandle,
	type TabbedContainerProps,
	type TabDefinition,
	type TabEntry,
} from "./types";
import { useMobileTabBarCollapse } from "./use-mobile-tab-bar-collapse";
import { useTabbedContainer } from "./use-tabbed-container";

export const TabbedContainer = memo(function TabbedContainer({
	tabs,
	cssPrefix,
	lazy = true,
	currentState,
	defaults,
	onTabChange,
	onStateChange,
	editable = false,
	hoverDropdown = false,
	app,
	tabBarContainer,
	tabBarInsertBefore,
	handleRef,
	collapseTabBarOnMobile = true,
	tabBarCollapseStorageKey,
	showMobileTabBarToggle = true,
}: TabbedContainerProps) {
	useInjectedStyles(`${cssPrefix}tabbed-container-styles`, buildTabbedContainerStyles(cssPrefix));

	const result = useTabbedContainer({
		tabs,
		...(currentState !== undefined ? { currentState } : {}),
		...(defaults !== undefined ? { defaults } : {}),
		...(onStateChange ? { onStateChange } : {}),
		...(onTabChange ? { onTabChange } : {}),
	});
	const { state, actions, getState, getVisibleLabels } = result;
	const { visibleTabs, currentIndex, activeTab, showSettingsButton } = state;

	const [managerOpen, setManagerOpen] = useState(false);
	const closeManager = useCallback(() => setManagerOpen(false), []);

	const {
		isMobile: isNarrow,
		collapsed: tabBarCollapsed,
		setCollapsed: setTabBarCollapsed,
		toggle: toggleTabBar,
	} = useMobileTabBarCollapse({
		storageKey: tabBarCollapseStorageKey ?? `${cssPrefix}tab-bar-collapsed`,
		enabled: collapseTabBarOnMobile,
	});

	const containerRef = useRef<HTMLDivElement>(null);
	const tabBarRef = useRef<HTMLDivElement>(null);
	const isActiveRef = useRef(false);

	useDomEvent(typeof activeDocument !== "undefined" ? activeDocument : null, "pointerdown", (e) => {
		const target = e.target as Node;
		isActiveRef.current = !!(
			(containerRef.current && containerRef.current.contains(target)) ||
			(tabBarRef.current && tabBarRef.current.contains(target))
		);
	});

	useDomEvent(typeof activeDocument !== "undefined" ? activeDocument : null, "keydown", (e) => {
		if (!isActiveRef.current || isTypingTarget(e.target)) return;
		const handler = activeTab?.keyHandlers?.[e.key];
		if (handler) {
			handler(e);
			e.preventDefault();
		}
	});

	const handle: TabbedContainerHandle = useMemo(
		() => ({
			switchTo: actions.switchTo,
			next: actions.next,
			previous: actions.previous,
			hideTab: actions.hideTab,
			restoreTab: actions.restoreTab,
			moveTab: actions.moveTab,
			showTabManager: () => setManagerOpen(true),
			getState,
			getVisibleLabels,
			get activeIndex() {
				return currentIndex;
			},
			get activeId() {
				return state.activeId;
			},
			get tabCount() {
				return visibleTabs.length;
			},
			get tabBarCollapsed() {
				return tabBarCollapsed;
			},
			setTabBarCollapsed,
			toggleTabBar,
		}),
		[
			actions,
			getState,
			getVisibleLabels,
			currentIndex,
			state.activeId,
			visibleTabs.length,
			tabBarCollapsed,
			setTabBarCollapsed,
			toggleTabBar,
		]
	);

	useEffect(() => {
		if (!handleRef) return;
		handleRef.current = handle;
		return () => {
			if (handleRef.current === handle) handleRef.current = null;
		};
	}, [handleRef, handle]);

	// The chip lives in the bar when expanded and stands alone when collapsed, so
	// the affordance that hid the tabs is also the one that brings them back.
	const collapseChip =
		isNarrow && collapseTabBarOnMobile && showMobileTabBarToggle ? (
			<button
				type="button"
				className={cx(`${cssPrefix}tab`, `${cssPrefix}tab-bar-toggle`)}
				onClick={toggleTabBar}
				aria-expanded={!tabBarCollapsed}
				aria-label={tabBarCollapsed ? "Show tabs" : "Hide tabs"}
				data-testid={`${cssPrefix}tab-bar-toggle`}
			>
				<ObsidianIcon icon={tabBarCollapsed ? "chevron-right" : "chevron-down"} />
			</button>
		) : null;

	// Collapsed renders no TabBar at all rather than hiding it — a hidden bar still
	// mounts every tab button and costs the layout pass we collapsed to reclaim.
	const tabBar = tabBarCollapsed ? (
		collapseChip && <div className={cx(`${cssPrefix}tab-bar`, `${cssPrefix}tab-bar-collapsed`)}>{collapseChip}</div>
	) : (
		<TabBar
			ref={tabBarRef}
			leading={collapseChip}
			cssPrefix={cssPrefix}
			visibleTabs={visibleTabs}
			currentIndex={currentIndex}
			editable={editable}
			showSettingsButton={showSettingsButton}
			hoverDropdown={hoverDropdown}
			getLabel={state.getLabel}
			getAppearance={state.getAppearance}
			getChildLabel={state.getChildLabel}
			getChildAppearance={state.getChildAppearance}
			onSelectTab={actions.switchTo}
			onSelectGroupChild={actions.switchGroupChild}
			onShowManager={() => setManagerOpen(true)}
			groupStates={state.groupStates}
			canShowManager={!!app}
		/>
	);

	// On phones / narrow panes the `.view-header` portal host is shared with the
	// title and page-header actions, leaving the bar a sliver. So at mobile width we
	// skip the portal and render the bar inline in the content pane, where it gets
	// the full pane width for its one row (overflow goes behind `⋯`). Reactive, so
	// rotating or resizing across the breakpoint moves the bar to the right place.
	// `isNarrow` comes from useMobileTabBarCollapse above — one media subscription
	// answers both "portal or inline?" and "collapsible?".
	const tabBarRendered = useTabBarPortal(
		tabBar,
		tabBarContainer ?? null,
		tabBarInsertBefore ?? null,
		!isNarrow,
		cssPrefix
	);

	const tree = (
		<div ref={containerRef} className={`${cssPrefix}tabbed-container`}>
			{tabBarRendered}
			<div className={`${cssPrefix}tab-content`}>
				{visibleTabs.map((entry) => (
					<TabPanels
						key={entry.id}
						entry={entry}
						cssPrefix={cssPrefix}
						isActiveEntry={entry.id === visibleTabs[currentIndex]?.id}
						activeTabId={activeTab?.id ?? ""}
						lazy={lazy}
						rendered={state.rendered}
						groupStates={state.groupStates}
					/>
				))}
			</div>
			{editable && app && (
				<TabManagerModal
					cssPrefix={cssPrefix}
					open={managerOpen}
					onClose={closeManager}
					state={state}
					actions={actions}
				/>
			)}
		</div>
	);

	return app ? <AppContext value={app}>{tree}</AppContext> : tree;
});

// ─── Tab bar portal ───

function useTabBarPortal(
	node: React.ReactNode,
	host: HTMLElement | null,
	insertBefore: Element | null,
	enabled: boolean,
	cssPrefix: string
): React.ReactNode {
	// `enabled: false` (mobile) renders the bar inline instead of portaling it —
	// the null placeholder below also short-circuits the effect, so it no-ops.
	const activeHost = enabled ? host : null;
	const placeholderRef = useRef<HTMLDivElement | null>(null);
	const placeholderEl = useMemo(() => {
		if (!activeHost) return null;

		// Detached on purpose — the effect below decides where it lands.
		return createDiv({ cls: `${cssPrefix}tab-portal-slot` });
	}, [activeHost, cssPrefix]);

	useEffect(() => {
		if (!host || !placeholderEl) return;
		if (insertBefore && insertBefore.parentElement === host) {
			host.insertBefore(placeholderEl, insertBefore);
		} else {
			host.appendChild(placeholderEl);
		}
		placeholderRef.current = placeholderEl;
		return () => {
			placeholderEl.remove();
			placeholderRef.current = null;
		};
	}, [host, placeholderEl, insertBefore]);

	if (!activeHost) return node;
	if (!placeholderEl) return null;
	return createPortal(node, placeholderEl);
}

// ─── Tab bar ───

interface TabBarProps {
	ref: RefObject<HTMLDivElement | null>;
	/** Rendered before the first tab — the mobile collapse chip, when there is one. */
	leading: ReactNode;
	cssPrefix: string;
	visibleTabs: TabEntry[];
	currentIndex: number;
	editable: boolean;
	showSettingsButton: boolean;
	hoverDropdown: boolean;
	getLabel: (entry: TabEntry) => string;
	getAppearance: (entry: TabEntry) => Appearance;
	getChildLabel: (groupId: string, child: TabDefinition) => string;
	getChildAppearance: (groupId: string, child: TabDefinition) => Appearance;
	onSelectTab: (id: string) => void;
	onSelectGroupChild: (groupId: string, childId: string) => void;
	onShowManager: () => void;
	groupStates: Map<string, GroupChildState>;
	canShowManager: boolean;
}

// Imperative markers, not React state: re-measuring on resize has to show every tab
// to read its true position, and a render round-trip per step would flicker.
const TAB_OVERFLOW_ATTR = "data-tab-overflow";
const TAB_OVERFLOW_ACTIVE_ATTR = "data-tab-overflow-active";
const TAB_ID_ATTR = "data-tab-id";

/**
 * Keep the tab bar to one row: hide trailing tabs until the row's last visible control
 * (the overflow trigger, then Manage) fits inside the bar, and flag the bar so CSS
 * reveals the trigger. Same position-based model as the page header's
 * `usePackActionRow` — measuring real rects is right whatever the host flexbox does
 * with the bar's width, where width arithmetic is not.
 *
 * The active tab is skipped so it can never be trimmed: hiding it would leave the
 * user on a tab with no visible marker of where they are.
 *
 * `revision` must change whenever the tab set, a label, or the active tab changes,
 * since each moves the fit.
 */
function usePackTabRow(barRef: RefObject<HTMLDivElement | null>, revision: string): void {
	useLayoutEffect(() => {
		const bar = barRef.current;
		if (!bar) return;

		const rightmostVisibleEdge = (): number => {
			let right = Number.NEGATIVE_INFINITY;
			for (const child of Array.from(bar.children)) {
				const rect = child.getBoundingClientRect();
				if (rect.width > 0) right = Math.max(right, rect.right);
			}
			return right;
		};

		const pack = (): void => {
			const tabs = Array.from(bar.querySelectorAll<HTMLElement>(`:scope > [${TAB_ID_ATTR}]`));
			for (const tab of tabs) tab.removeAttribute(TAB_OVERFLOW_ATTR);
			bar.setAttribute(TAB_OVERFLOW_ACTIVE_ATTR, "false");

			const barRect = bar.getBoundingClientRect();
			if (barRect.width <= 0) return; // not laid out yet (jsdom, hidden pane)
			const paddingRight = parseFloat(getComputedStyle(bar).paddingRight) || 0;
			const limit = barRect.right - paddingRight + 0.5;
			if (rightmostVisibleEdge() <= limit) return;

			bar.setAttribute(TAB_OVERFLOW_ACTIVE_ATTR, "true");
			for (let i = tabs.length - 1; i >= 0 && rightmostVisibleEdge() > limit; i--) {
				if (tabs[i].getAttribute("aria-selected") === "true") continue;
				tabs[i].setAttribute(TAB_OVERFLOW_ATTR, "true");
			}
		};

		pack();
		if (typeof ResizeObserver === "undefined" || typeof requestAnimationFrame === "undefined") return;
		// Next-frame debounce: pack() mutates layout, and running it inside the observer
		// callback trips "ResizeObserver loop" warnings.
		let frame = 0;
		const schedule = (): void => {
			if (frame) window.cancelAnimationFrame(frame);
			frame = window.requestAnimationFrame(pack);
		};
		const observer = new ResizeObserver(schedule);
		observer.observe(bar);
		return () => {
			if (frame) window.cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [barRef, revision]);
}

const TabBar = memo(function TabBar({
	ref,
	leading,
	cssPrefix,
	visibleTabs,
	currentIndex,
	editable,
	showSettingsButton,
	hoverDropdown,
	getLabel,
	getAppearance,
	getChildLabel,
	getChildAppearance,
	onSelectTab,
	onSelectGroupChild,
	onShowManager,
	groupStates,
	canShowManager,
}: TabBarProps) {
	const overflowTriggerRef = useRef<HTMLButtonElement>(null);
	const [overflowMenu, setOverflowMenu] = useState<{
		items: ContextMenuItemDef[];
		position: { x: number; y: number };
	} | null>(null);

	const fitRevision = `${visibleTabs.map((entry) => `${entry.id}:${getLabel(entry)}`).join("|")}::${currentIndex}`;
	usePackTabRow(ref, fitRevision);

	// Built from the DOM markers, the source of truth for what the fit actually hid
	// at this width.
	const openOverflowMenu = useCallback(() => {
		const bar = ref.current;
		if (!bar) return;
		const hiddenIds = new Set(
			Array.from(bar.querySelectorAll<HTMLElement>(`[${TAB_OVERFLOW_ATTR}="true"]`)).map((el) =>
				el.getAttribute(TAB_ID_ATTR)
			)
		);
		const items: ContextMenuItemDef[] = [];
		for (const entry of visibleTabs) {
			if (!hiddenIds.has(entry.id)) continue;
			const label = getLabel(entry);
			if (isGroupTab(entry)) {
				// A group's own button only opens its dropdown; listing the children
				// directly saves a second menu on a phone.
				const children = groupStates.get(entry.id)?.visibleChildren ?? entry.children;
				for (const child of children) {
					items.push({
						kind: "item",
						id: `${entry.id}--${child.id}`,
						label: `${label} › ${getChildLabel(entry.id, child)}`,
						onSelect: () => onSelectGroupChild(entry.id, child.id),
					});
				}
				continue;
			}
			const { icon } = getAppearance(entry);
			items.push({
				kind: "item",
				id: entry.id,
				label,
				...(icon ? { icon } : {}),
				onSelect: () => onSelectTab(entry.id),
			});
		}
		if (items.length === 0) return;
		const rect = overflowTriggerRef.current?.getBoundingClientRect();
		setOverflowMenu({ items, position: rect ? { x: rect.right, y: rect.bottom + 4 } : { x: 0, y: 0 } });
	}, [ref, visibleTabs, getLabel, getAppearance, getChildLabel, groupStates, onSelectTab, onSelectGroupChild]);

	const closeOverflowMenu = useCallback(() => setOverflowMenu(null), []);

	return (
		<div ref={ref} className={`${cssPrefix}tab-bar`} role="tablist">
			{leading}
			{visibleTabs.map((entry, index) => {
				const isActive = index === currentIndex;
				if (isGroupTab(entry)) {
					return (
						<GroupTabButton
							key={entry.id}
							cssPrefix={cssPrefix}
							group={entry}
							isActive={isActive}
							hoverDropdown={hoverDropdown}
							label={getLabel(entry)}
							appearance={getAppearance(entry)}
							getChildLabel={(child) => getChildLabel(entry.id, child)}
							getChildAppearance={(child) => getChildAppearance(entry.id, child)}
							visibleChildren={groupStates.get(entry.id)?.visibleChildren ?? entry.children}
							onSelectChild={(childId) => onSelectGroupChild(entry.id, childId)}
						/>
					);
				}
				return (
					<TabButton
						key={entry.id}
						cssPrefix={cssPrefix}
						id={entry.id}
						isActive={isActive}
						label={getLabel(entry)}
						appearance={getAppearance(entry)}
						onClick={() => onSelectTab(entry.id)}
					/>
				);
			})}

			{/* Always mounted so the fit measurement is stable; CSS shows it only while
			    the bar is flagged overflow-active. The sole path to trimmed tabs. */}
			<button
				ref={overflowTriggerRef}
				type="button"
				className={`${cssPrefix}tab ${cssPrefix}tab-bar-overflow`}
				onClick={openOverflowMenu}
				data-testid={`${cssPrefix}tab-bar-overflow`}
				aria-label="More tabs"
				aria-haspopup="menu"
				aria-expanded={overflowMenu !== null}
			>
				<ObsidianIcon icon="more-horizontal" />
			</button>

			{editable && canShowManager && showSettingsButton && (
				<button
					type="button"
					className={`${cssPrefix}tab ${cssPrefix}tab-settings`}
					onClick={onShowManager}
					data-testid={`${cssPrefix}tabbed-container-manage`}
					aria-label="Manage tabs"
				>
					<ObsidianIcon icon="settings-2" />
				</button>
			)}

			{overflowMenu && (
				<ContextMenu
					items={overflowMenu.items}
					position={overflowMenu.position}
					onDismiss={closeOverflowMenu}
					testIdPrefix={cssPrefix}
					align="right"
				/>
			)}
		</div>
	);
});

interface TabButtonProps {
	cssPrefix: string;
	id: string;
	label: string;
	appearance: Appearance;
	isActive: boolean;
	extraClass?: string;
	trailing?: ReactNode;
	buttonRef?: Ref<HTMLButtonElement>;
	ariaHasPopup?: "menu";
	ariaExpanded?: boolean;
	onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
	onPointerDown?: () => void;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
}

const TabButton = memo(function TabButton({
	cssPrefix,
	id,
	label,
	appearance,
	isActive,
	extraClass,
	trailing,
	buttonRef,
	ariaHasPopup,
	ariaExpanded,
	onClick,
	onPointerDown,
	onMouseEnter,
	onMouseLeave,
}: TabButtonProps) {
	return (
		<button
			ref={buttonRef}
			type="button"
			role="tab"
			aria-selected={isActive}
			aria-haspopup={ariaHasPopup}
			aria-expanded={ariaExpanded}
			className={cx(`${cssPrefix}tab`, extraClass, isActive && `${cssPrefix}tab-active`)}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			data-tab-id={id}
			data-testid={`${cssPrefix}view-tab-${id}`}
			style={appearanceStyle(appearance, "backgroundColor")}
		>
			{appearance.icon && (
				<span className={`${cssPrefix}tab-icon`} style={appearanceStyle(appearance, "color")}>
					<ObsidianIcon icon={appearance.icon} />
				</span>
			)}
			<span style={appearanceStyle(appearance, "textColor")}>{label}</span>
			{trailing}
		</button>
	);
});

interface GroupTabButtonProps {
	cssPrefix: string;
	group: GroupTabDefinition;
	isActive: boolean;
	hoverDropdown: boolean;
	label: string;
	appearance: Appearance;
	getChildLabel: (child: TabDefinition) => string;
	getChildAppearance: (child: TabDefinition) => Appearance;
	visibleChildren: TabDefinition[];
	onSelectChild: (childId: string) => void;
}

const GroupTabButton = memo(function GroupTabButton({
	cssPrefix,
	group,
	isActive,
	hoverDropdown,
	label,
	appearance,
	getChildLabel,
	getChildAppearance,
	visibleChildren,
	onSelectChild,
}: GroupTabButtonProps) {
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const hoverTimerRef = useRef<number | null>(null);
	const skipNextClickRef = useRef(false);

	const openAt = useCallback((target: HTMLElement) => {
		const rect = target.getBoundingClientRect();
		setPosition({ x: rect.left, y: rect.bottom });
	}, []);

	const close = useCallback(() => setPosition(null), []);

	const handlePointerDown = useCallback(() => {
		// Mirror the imperative version: when the dropdown is open and the user
		// presses the trigger again, the click-outside handler in GroupDropdown
		// will close it on mousedown — so the subsequent `click` event must NOT
		// reopen it. Set a skip flag synchronously here.
		if (position) skipNextClickRef.current = true;
	}, [position]);

	const handleClick = useCallback(
		(e: ReactMouseEvent<HTMLButtonElement>) => {
			if (skipNextClickRef.current) {
				skipNextClickRef.current = false;
				return;
			}
			openAt(e.currentTarget);
		},
		[openAt]
	);

	const handleMouseEnter = useCallback(() => {
		if (!hoverDropdown) return;
		if (hoverTimerRef.current) {
			window.clearTimeout(hoverTimerRef.current);
			hoverTimerRef.current = null;
		}
		if (!position && buttonRef.current) openAt(buttonRef.current);
	}, [hoverDropdown, position, openAt]);

	const scheduleClose = useCallback(() => {
		if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = window.setTimeout(() => {
			hoverTimerRef.current = null;
			close();
		}, 200);
	}, [close]);

	const handleMouseLeave = useCallback(() => {
		if (!hoverDropdown) return;
		scheduleClose();
	}, [hoverDropdown, scheduleClose]);

	useEffect(() => {
		return () => {
			if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
		};
	}, []);

	const handleSelect = useCallback(
		(childId: string) => {
			close();
			onSelectChild(childId);
		},
		[close, onSelectChild]
	);

	return (
		<>
			<TabButton
				cssPrefix={cssPrefix}
				id={group.id}
				label={label}
				appearance={appearance}
				isActive={isActive}
				extraClass={`${cssPrefix}tab-group`}
				buttonRef={buttonRef}
				ariaHasPopup="menu"
				ariaExpanded={position !== null}
				onPointerDown={handlePointerDown}
				onClick={handleClick}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				trailing={
					<span className={`${cssPrefix}tab-group-chevron`}>
						<ObsidianIcon icon="chevron-down" />
					</span>
				}
			/>
			{position && (
				<GroupDropdown
					groupId={group.id}
					cssPrefix={cssPrefix}
					testIdPrefix={cssPrefix}
					position={position}
					items={visibleChildren}
					getChildLabel={getChildLabel}
					getChildAppearance={getChildAppearance}
					onSelect={handleSelect}
					onDismiss={close}
					hoverDropdown={hoverDropdown}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={scheduleClose}
				/>
			)}
		</>
	);
});

// ─── Tab panels (lazy-aware) ───

interface TabPanelsProps {
	entry: TabEntry;
	cssPrefix: string;
	isActiveEntry: boolean;
	activeTabId: string;
	lazy: boolean;
	rendered: Set<string>;
	groupStates: Map<string, GroupChildState>;
}

const TabPanels = memo(function TabPanels({
	entry,
	cssPrefix,
	isActiveEntry,
	activeTabId,
	lazy,
	rendered,
	groupStates,
}: TabPanelsProps) {
	const activeChild = getActiveChild(entry, groupStates);
	const tab = activeChild;
	const isActive = isActiveEntry && tab.id === activeTabId;

	if (lazy && !isActive && !rendered.has(tab.id)) return null;

	const content = typeof tab.content === "function" ? tab.content() : tab.content;

	return (
		<div
			role="tabpanel"
			className={cx(`${cssPrefix}tab-panel`, !isActive && `${cssPrefix}tab-panel-hidden`)}
			data-tab-id={tab.id}
			data-testid={`${cssPrefix}tab-content-${tab.id}`}
		>
			{content}
		</div>
	);
});
