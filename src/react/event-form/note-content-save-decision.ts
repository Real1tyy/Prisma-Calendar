export type NoteContentSaveDecision = "skip" | "write" | "confirm-then-write";

/** The body is opt-in on edit so an untouched modal can never overwrite a file. */
export function decideNoteContentSave(dirty: boolean, changedOnDisk: boolean): NoteContentSaveDecision {
	if (!dirty) return "skip";
	return changedOnDisk ? "confirm-then-write" : "write";
}
