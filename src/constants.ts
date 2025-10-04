export const PLUGIN_ID = "prisma-calendar";

// Command IDs (without plugin prefix)
export const COMMAND_IDS = {
	SHOW_SKIPPED_EVENTS: "show-skipped-events",
	UNDO: "undo",
	REDO: "redo",
	TOGGLE_BATCH_SELECTION: "toggle-batch-selection",
	BATCH_SELECT_ALL: "batch-select-all",
	BATCH_CLEAR_SELECTION: "batch-clear-selection",
	BATCH_DUPLICATE_SELECTION: "batch-duplicate-selection",
	BATCH_DELETE_SELECTION: "batch-delete-selection",
	BATCH_SKIP_SELECTION: "batch-skip-selection",
	BATCH_OPEN_SELECTION: "batch-open-selection",
	BATCH_CLONE_NEXT_WEEK: "batch-clone-next-week",
	BATCH_CLONE_PREV_WEEK: "batch-clone-prev-week",
	BATCH_MOVE_NEXT_WEEK: "batch-move-next-week",
	BATCH_MOVE_PREV_WEEK: "batch-move-prev-week",
} as const;

export const FULL_COMMAND_IDS = Object.fromEntries(
	Object.entries(COMMAND_IDS).map(([key, value]) => [key, `${PLUGIN_ID}:${value}`])
) as { [K in keyof typeof COMMAND_IDS]: `${typeof PLUGIN_ID}:${(typeof COMMAND_IDS)[K]}` };
