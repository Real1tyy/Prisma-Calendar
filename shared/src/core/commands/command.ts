export interface Command {
	execute(): Promise<void>;
	undo(): Promise<void>;
	getType(): string;
	canUndo?(): boolean | Promise<boolean>;
	/**
	 * Human-readable label for the operation-history UI. Absent, the manager
	 * falls back to `humanizeCommandType(getType())` — implement this when the
	 * type alone doesn't tell the user what happened (e.g. a batch that should
	 * report how many files it touched).
	 */
	describe?(): string;
}
