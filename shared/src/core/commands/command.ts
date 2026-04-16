export interface Command {
	execute(): Promise<void>;
	undo(): Promise<void>;
	getType(): string;
	canUndo?(): boolean | Promise<boolean>;
}
