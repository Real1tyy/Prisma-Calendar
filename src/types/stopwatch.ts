export type StopwatchState = "idle" | "running" | "paused" | "stopped";

export interface StopwatchSnapshot {
	state: StopwatchState;
	startTime: number | null;
	breakStartTime: number | null;
	sessionStartTime: number | null;
	totalBreakMs: number;
}
