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
 * FullCalendar has three chunks and a phone header needs four rows, so the mobile
 * left chunk carries two: row 1, then — after `navBreak`, a zero-height
 * full-width item CSS turns into a line break — the Nav row (Today, Now, the
 * date), hidden until **Nav** is pressed. The centre chunk is row 2, the right
 * chunk the view switchers. Filtered/skipped counts fold into one `statusMenu`
 * icon there. See [[spec-mobile-calendar-header-row-economy]].
 */
export function buildHeaderToolbarChunks({
	isMobile,
	enabledButtons,
	showMobileControlsToggle,
	showAllDayMode,
}: ToolbarLayoutInput): HeaderToolbarChunks {
	const prevNext = enabledButtons.has("prevNext") ? ["prev", "next"] : [];
	const today = enabledButtons.has("today") ? ["today"] : [];
	const now = enabledButtons.has("now") ? ["now"] : [];
	const create = enabledButtons.has("createEvent") ? ["createEvent"] : [];
	const zoom = enabledButtons.has("zoomLevel") ? ["zoomLevel"] : [];

	if (isMobile) {
		const row1 = [
			"headerCollapse",
			...prevNext,
			...create,
			...zoom,
			...(showMobileControlsToggle ? ["mobileControls"] : []),
			"tabsToggle",
			"navToggle",
		];
		const navRow = ["navBreak", ...today, ...now, "title"];
		const row2 = [
			"statusMenu",
			"eventsButton",
			"batchSelect",
			...(showAllDayMode ? ["allDayMode"] : []),
			"viewsToggle",
		];
		return {
			left: [...row1, ...navRow].join(" "),
			center: row2.join(" "),
			right: VIEW_SWITCHER_BUTTONS,
		};
	}

	const navItems = [...prevNext, ...today, ...now, ...create, ...zoom];
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

export interface BatchToolbarInput {
	isMobile: boolean;
	/** The batch action buttons the user enabled, in order. */
	actionButtons: readonly string[];
}

/** On a phone, Exit rides beside the date rather than ending a row of its own. */
export function buildBatchToolbarChunks({ isMobile, actionButtons }: BatchToolbarInput): HeaderToolbarChunks {
	const left = "prev,next today";
	if (isMobile) {
		return { left, center: "title batchExit", right: ["batchCounter", ...actionButtons].join(" ") };
	}
	return { left, center: "title", right: ["batchCounter", ...actionButtons, "batchExit"].join(" ") };
}

export interface HiddenEventsMenuItem {
	kind: "filtered" | "skipped";
	label: string;
}

/** What the phone status button lists: only the counts that are non-zero. */
export function hiddenEventsMenuItems(filtered: number, skipped: number): HiddenEventsMenuItem[] {
	const items: HiddenEventsMenuItem[] = [];
	if (filtered > 0) items.push({ kind: "filtered", label: `${filtered} filtered` });
	if (skipped > 0) items.push({ kind: "skipped", label: `${skipped} skipped` });
	return items;
}

/** "Batch Select" does not fit a phone row next to the date; "Batch" does. */
export function batchSelectLabel(isMobile: boolean): string {
	return isMobile ? "Batch" : "Batch Select";
}

export interface TitleFormat {
	year?: "numeric";
	month?: "short";
	day?: "numeric";
}

/**
 * The phone header shares one row between the date and five buttons, so the
 * year goes wherever the view makes it obvious ("Nov 4", "Nov 2 – 8",
 * "Nov 2026"). `undefined` on desktop hands the choice back to FullCalendar's
 * own per-view default — `titleFormat` cannot be set per view at runtime.
 */
export function titleFormatFor(viewType: string, isMobile: boolean): TitleFormat | undefined {
	if (!isMobile) return undefined;
	if (viewType.startsWith("multiMonth")) return { year: "numeric" };
	if (viewType === "dayGridMonth") return { month: "short", year: "numeric" };
	return { month: "short", day: "numeric" };
}
