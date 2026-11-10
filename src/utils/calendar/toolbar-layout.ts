/**
 * Pure layout contract for FullCalendar's `headerToolbar` — which button name
 * lands in which chunk, and what the shared buttons are labelled.
 *
 * Split out of `CalendarComponent` because the mobile branch is a *layout*
 * decision with no DOM in it: the row shape is the thing worth pinning in a
 * unit test, and doing that through a real FullCalendar render is a tier too
 * expensive. The row model and FullCalendar's chunk quirks are written up in
 * [[knowledge-collapsible-mobile-chrome-tab-bar-and-calendar-header]].
 */

export const VIEW_SWITCHER_BUTTONS = "multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay,listWeek";

export interface HeaderToolbarChunks {
	left: string;
	center: string;
	right: string;
}

export interface ToolbarLayoutInput {
	/** `shouldUseMobileLayout()` — platform signal OR narrow pane. */
	isMobile: boolean;
	/** Toolbar button ids the user left enabled for this form factor. */
	enabledButtons: ReadonlySet<string>;
	/** Whether the "Filters" collapse toggle has anything to collapse. */
	showMobileControlsToggle: boolean;
	/** All-day modes only mean something in a `timeGrid` view. */
	showAllDayMode: boolean;
}

/**
 * Mobile packs action buttons into the *centre* chunk alongside the title.
 * FullCalendar accepts arbitrary button names there, and it is the only way to
 * get buttons on both sides of the title without a third row — which is the
 * whole point of the collapse (five rows of chrome on a phone).
 */
export function buildHeaderToolbarChunks({
	isMobile,
	enabledButtons,
	showMobileControlsToggle,
	showAllDayMode,
}: ToolbarLayoutInput): HeaderToolbarChunks {
	const navItems: string[] = [];
	if (enabledButtons.has("prevNext")) navItems.push("prev", "next");
	if (enabledButtons.has("today")) navItems.push("today");
	if (enabledButtons.has("now")) navItems.push("now");
	if (enabledButtons.has("createEvent")) navItems.push("createEvent");
	if (enabledButtons.has("zoomLevel")) navItems.push("zoomLevel");
	if (isMobile && showMobileControlsToggle) navItems.push("mobileControls");

	if (isMobile) {
		const center = [
			"filteredEvents",
			"skippedEvents",
			"eventsButton",
			"title",
			"batchSelect",
			...(showAllDayMode ? ["allDayMode"] : []),
			"viewsToggle",
		];
		return {
			left: ["headerCollapse", ...navItems, "tabsToggle"].join(" "),
			center: center.join(" "),
			right: VIEW_SWITCHER_BUTTONS,
		};
	}

	const right = [
		"filteredEvents",
		"eventsButton",
		"skippedEvents",
		"batchSelect",
		...(showAllDayMode ? ["allDayMode"] : []),
		VIEW_SWITCHER_BUTTONS,
	];
	return { left: navItems.join(" "), center: "title", right: right.join(" ") };
}

/** "Batch Select" does not fit a phone row next to the date; "Batch" does. */
export function batchSelectLabel(isMobile: boolean): string {
	return isMobile ? "Batch" : "Batch Select";
}
