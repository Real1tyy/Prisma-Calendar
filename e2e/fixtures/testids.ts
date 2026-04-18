// Single source of truth for every `data-testid` stamped by plugin source.
// Specs import `TID.*` instead of splicing `prisma-*` strings by hand. When
// the plugin renames a test-id, updating the matching entry here recompiles
// every consumer — TypeScript catches the breakage at build time, not as a
// flaky runtime selector miss.
//
// Key types are string-literal unions. New ids get added here and the plugin
// source simultaneously; if a spec tries to address an unknown id it fails
// to compile.

export type ContextMenuItemKey =
	| "enlarge"
	| "preview"
	| "editEvent"
	| "assignCategories"
	| "assignPrerequisites"
	| "duplicateEvent"
	| "moveBy"
	| "markDone"
	| "moveToNextWeek"
	| "cloneToNextWeek"
	| "moveToPreviousWeek"
	| "cloneToPreviousWeek"
	| "deleteEvent"
	| "skipEvent"
	| "openFile"
	| "openFileNewWindow";

export type EventControlKey =
	| "title"
	| "allDay"
	| "start"
	| "end"
	| "date"
	| "duration"
	| "location"
	| "icon"
	| "skip"
	| "breakMinutes"
	| "notify-before"
	| "rrule"
	| "rrule-type"
	| "custom-freq"
	| "custom-interval";

export type EventFieldKey = "title" | "categories" | "prerequisites" | "participants";

export type EventBtnKey = "save" | "cancel" | "assign-categories" | "assign-prerequisites" | "add-custom-prop-other";

export type ToolbarKey =
	| "create"
	| "view-month"
	| "view-week"
	| "view-day"
	| "view-list"
	| "next"
	| "prev"
	| "today"
	| "batch-select"
	| "batch-exit";

export type BatchBtnKey =
	| "select-all"
	| "clear"
	| "duplicate"
	| "move-by"
	| "mark-done"
	| "mark-not-done"
	| "categories"
	| "frontmatter"
	| "clone-next"
	| "clone-prev"
	| "move-next"
	| "move-prev"
	| "open-all"
	| "skip"
	| "make-virtual"
	| "make-real"
	| "delete";

export const EVENT_BLOCK_TID = "prisma-cal-event";
export const BATCH_COUNTER_TID = "prisma-cal-batch-counter";
export const BATCH_CONFIRM_TID = "prisma-batch-confirm-submit";

export const TID = {
	event: {
		control: (key: EventControlKey): string => `prisma-event-control-${key}`,
		field: (key: EventFieldKey): string => `prisma-event-field-${key}`,
		btn: (key: EventBtnKey): string => `prisma-event-btn-${key}`,
	},
	toolbar: (key: ToolbarKey): string => `prisma-cal-toolbar-${key}`,
	batch: (key: BatchBtnKey): string => `prisma-cal-batch-${key}`,
	batchCounter: BATCH_COUNTER_TID,
	batchConfirm: BATCH_CONFIRM_TID,
	ctxMenu: (key: ContextMenuItemKey): string => `prisma-context-menu-item-${key}`,
	ribbon: (calendarId: string): string => `prisma-ribbon-open-${calendarId}`,
	block: EVENT_BLOCK_TID,
} as const;

/** CSS attribute selector for a testid, e.g. `sel("prisma-cal-event")` → `[data-testid="prisma-cal-event"]`. */
export function sel(testId: string): string {
	return `[data-testid="${testId}"]`;
}
