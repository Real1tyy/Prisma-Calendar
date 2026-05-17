// Plain leaf module — no Obsidian / `@real1ty-obsidian-plugins` deps — so e2e
// fixtures and other build-free contexts can import these without dragging the
// full plugin runtime through ts-node. `src/constants.ts` re-exports the same
// symbols for plugin source code.

export const CONTEXT_MENU_BUTTON_LABELS = {
	enlarge: "Enlarge",
	preview: "Preview",
	goToSource: "Go to source",
	editSourceEvent: "Edit source event",
	viewEventGroups: "View event groups",
	viewNameSeries: "Show name series",
	viewCategorySeries: "Show category series",
	viewRecurringSeries: "Show recurring series",
	editEvent: "Edit event",
	assignCategories: "Assign categories",
	assignPrerequisites: "Assign prerequisites",
	duplicateEvent: "Duplicate event",
	moveBy: "Move by...",
	moveToCalendar: "Move to planning system...",
	markDone: "Mark as done/undone",
	moveToNextWeek: "Move to next week",
	cloneToNextWeek: "Clone to next week",
	moveToPreviousWeek: "Move to previous week",
	cloneToPreviousWeek: "Clone to previous week",
	fillStartTimeNow: "Fill start time from current time",
	fillEndTimeNow: "Fill end time from current time",
	fillStartTimePrevious: "Fill start time from previous event",
	fillEndTimeNext: "Fill end time from next event",
	deleteEvent: "Delete event",
	skipEvent: "Skip event",
	openFile: "Open file",
	openFileNewWindow: "Open file in new window",
	toggleRecurring: "Enable/Disable recurring event",
	triggerStopwatch: "Trigger stopwatch",
	duplicateRemainingWeekDays: "Duplicate remaining week days",
	makeVirtual: "Make virtual",
	makeReal: "Make real",
	makeUntracked: "Make untracked",
} as const;

export const CONTEXT_MENU_ITEM_IDS = Object.keys(
	CONTEXT_MENU_BUTTON_LABELS
) as (keyof typeof CONTEXT_MENU_BUTTON_LABELS)[];

// Trimmed first-run defaults — these power-user / niche items stay registered
// and re-enableable in "Manage menu items…", but ship hidden so new users see
// a leaner right-click menu. Triage rationale for each:
//   - duplicateRemainingWeekDays: narrow weekday-batch workflow
//   - assignPrerequisites: requires the dependency-graph feature to be in use
//   - viewNameSeries / viewCategorySeries / viewRecurringSeries: redundant
//     direct-to-tab shortcuts; viewEventGroups already opens the same modal
//   - fillStartTimeNow / fillEndTimeNow: niche stopwatch-adjacent flow;
//     fillStartTimePrevious / fillEndTimeNext cover the common adjacency case
//   - openFileNewWindow: openFile covers the common open-in-place case
//   - cloneToPreviousWeek: moveToPreviousWeek covers the common case
const DEFAULT_HIDDEN_CONTEXT_MENU_ITEMS = [
	"duplicateRemainingWeekDays",
	"assignPrerequisites",
	"viewNameSeries",
	"viewCategorySeries",
	"viewRecurringSeries",
	"fillStartTimeNow",
	"fillEndTimeNow",
	"openFileNewWindow",
	"cloneToPreviousWeek",
] as const satisfies readonly (keyof typeof CONTEXT_MENU_BUTTON_LABELS)[];

export const DEFAULT_CONTEXT_MENU_ITEMS = CONTEXT_MENU_ITEM_IDS.filter(
	(id) => !(DEFAULT_HIDDEN_CONTEXT_MENU_ITEMS as readonly string[]).includes(id)
);
