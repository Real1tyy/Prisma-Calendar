import type { MouseEvent as ReactMouseEvent, ReactNode, Ref, RefObject } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ObsidianIcon } from "../../components/obsidian-icon";
import { AppContext } from "../../contexts/app-context";
import { useDomEvent } from "../../hooks/use-dom-event";
import { useInjectedStyles } from "../../hooks/use-injected-styles";
import { cx } from "../../utils/cx";
import { GroupDropdown } from "./group-dropdown";
import { getActiveChild, type GroupChildState } from "./reorder";
import { buildTabbedContainerStyles } from "./styles";
import { TabManagerModal } from "./tab-manager-modal";
import type { GroupTabDefinition, TabbedContainerHandle, TabbedContainerProps, TabDefinition, TabEntry } from "./types";
import { isGroupTab } from "./types";
import { useTabbedContainer } from "./use-tabbed-container";

export const TabbedContainer = memo(function TabbedContainer({
	tabs,
	cssPrefix,
	lazy = true,
	initialState,
	onTabChange,
	onStateChange,
	editable = false,
	hoverDropdown = false,
	app,
	tabBarContainer,
	tabBarInsertBefore,
	handleRef,
}: TabbedContainerProps) {
	useInjectedStyles(`${cssPrefix}tabbed-container-styles`, buildTabbedContainerStyles(cssPrefix));

	const result = useTabbedContainer({
		tabs,
		...(initialState !== undefined ? { initialState } : {}),
		...(onStateChange ? { onStateChange } : {}),
		...(onTabChange ? { onTabChange } : {}),
	});
	const { state, actions, getState, getVisibleLabels } = result;
	const { visibleTabs, currentIndex, activeTab, showSettingsButton } = state;

	const [managerOpen, setManagerOpen] = useState(false);
	const closeManager = useCallback(() => setManagerOpen(false), []);

	const containerRef = useRef<HTMLDivElement>(null);
	const tabBarRef = useRef<HTMLDivElement>(null);
	const isActiveRef = useRef(false);

	useDomEvent(typeof document !== "undefined" ? document : null, "pointerdown", (e) => {
		const target = e.target as Node;
		isActiveRef.current = !!(
			(containerRef.current && containerRef.current.contains(target)) ||
			(tabBarRef.current && tabBarRef.current.contains(target))
		);
	});

	useDomEvent(typeof document !== "undefined" ? document : null, "keydown", (e) => {
		if (!isActiveRef.current) return;
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
		}),
		[actions, getState, getVisibleLabels, currentIndex, state.activeId, visibleTabs.length]
	);

	useEffect(() => {
		if (!handleRef) return;
		handleRef.current = handle;
		return () => {
			if (handleRef.current === handle) handleRef.current = null;
		};
	}, [handleRef, handle]);

	const tabBar = (
		<TabBar
			ref={tabBarRef}
			cssPrefix={cssPrefix}
			visibleTabs={visibleTabs}
			currentIndex={currentIndex}
			editable={editable}
			showSettingsButton={showSettingsButton}
			hoverDropdown={hoverDropdown}
			getLabel={state.getLabel}
			getIcon={state.getIcon}
			getColor={state.getColor}
			getChildLabel={state.getChildLabel}
			getChildIcon={state.getChildIcon}
			getChildColor={state.getChildColor}
			onSelectTab={actions.switchTo}
			onSelectGroupChild={actions.switchGroupChild}
			onShowManager={() => setManagerOpen(true)}
			groupStates={state.groupStates}
			canShowManager={!!app}
		/>
	);

	const tabBarRendered = useTabBarPortal(tabBar, tabBarContainer ?? null, tabBarInsertBefore ?? null);

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
	insertBefore: Element | null
): React.ReactNode {
	const placeholderRef = useRef<HTMLDivElement | null>(null);
	const placeholderEl = useMemo(() => {
		if (!host) return null;

		const el = document.createElement("div");
		el.style.display = "contents";
		return el;
	}, [host]);

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

	if (!host) return node;
	if (!placeholderEl) return null;
	return createPortal(node, placeholderEl);
}

// ─── Tab bar ───

interface TabBarProps {
	ref: RefObject<HTMLDivElement | null>;
	cssPrefix: string;
	visibleTabs: TabEntry[];
	currentIndex: number;
	editable: boolean;
	showSettingsButton: boolean;
	hoverDropdown: boolean;
	getLabel: (entry: TabEntry) => string;
	getIcon: (entry: TabEntry) => string | undefined;
	getColor: (entry: TabEntry) => string | undefined;
	getChildLabel: (groupId: string, child: TabDefinition) => string;
	getChildIcon: (groupId: string, child: TabDefinition) => string | undefined;
	getChildColor: (groupId: string, child: TabDefinition) => string | undefined;
	onSelectTab: (id: string) => void;
	onSelectGroupChild: (groupId: string, childId: string) => void;
	onShowManager: () => void;
	groupStates: Map<string, GroupChildState>;
	canShowManager: boolean;
}

const TabBar = memo(function TabBar({
	ref,
	cssPrefix,
	visibleTabs,
	currentIndex,
	editable,
	showSettingsButton,
	hoverDropdown,
	getLabel,
	getIcon,
	getColor,
	getChildLabel,
	getChildIcon,
	getChildColor,
	onSelectTab,
	onSelectGroupChild,
	onShowManager,
	groupStates,
	canShowManager,
}: TabBarProps) {
	return (
		<div ref={ref} className={`${cssPrefix}tab-bar`} role="tablist">
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
							icon={getIcon(entry)}
							color={getColor(entry)}
							getChildLabel={(child) => getChildLabel(entry.id, child)}
							getChildIcon={(child) => getChildIcon(entry.id, child)}
							getChildColor={(child) => getChildColor(entry.id, child)}
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
						icon={getIcon(entry)}
						color={getColor(entry)}
						onClick={() => onSelectTab(entry.id)}
					/>
				);
			})}

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
		</div>
	);
});

interface TabButtonProps {
	cssPrefix: string;
	id: string;
	label: string;
	icon: string | undefined;
	color: string | undefined;
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
	icon,
	color,
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
		>
			{icon && (
				<span className={`${cssPrefix}tab-icon`} style={color ? { color } : undefined}>
					<ObsidianIcon icon={icon} />
				</span>
			)}
			<span>{label}</span>
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
	icon: string | undefined;
	color: string | undefined;
	getChildLabel: (child: TabDefinition) => string;
	getChildIcon: (child: TabDefinition) => string | undefined;
	getChildColor: (child: TabDefinition) => string | undefined;
	visibleChildren: TabDefinition[];
	onSelectChild: (childId: string) => void;
}

const GroupTabButton = memo(function GroupTabButton({
	cssPrefix,
	group,
	isActive,
	hoverDropdown,
	label,
	icon,
	color,
	getChildLabel,
	getChildIcon,
	getChildColor,
	visibleChildren,
	onSelectChild,
}: GroupTabButtonProps) {
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
			clearTimeout(hoverTimerRef.current);
			hoverTimerRef.current = null;
		}
		if (!position && buttonRef.current) openAt(buttonRef.current);
	}, [hoverDropdown, position, openAt]);

	const scheduleClose = useCallback(() => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = setTimeout(() => {
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
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
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
				icon={icon}
				color={color}
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
					children={visibleChildren}
					getChildLabel={getChildLabel}
					getChildIcon={getChildIcon}
					getChildColor={getChildColor}
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
