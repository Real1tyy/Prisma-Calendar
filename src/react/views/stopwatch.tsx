import { cls, formatMsToHHMMSS } from "@real1ty-obsidian-plugins";
import { CollapsibleSection } from "@real1ty-obsidian-plugins-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, useState } from "react";
import { z } from "zod";

import { CSS_PREFIX } from "../../constants";

const STOPWATCH_STATES = ["idle", "running", "paused", "stopped"] as const;

export type StopwatchState = (typeof STOPWATCH_STATES)[number];

export interface StopwatchSnapshot {
	state: StopwatchState;
	startTime: number | null;
	breakStartTime: number | null;
	sessionStartTime: number | null;
	totalBreakMs: number;
}

export interface StopwatchCallbacks {
	onStart: (startTime: Date) => void;
	onContinueRequested: () => Date | null;
	onStop: (endTime: Date) => void;
	onBreakUpdate: (breakMinutes: number) => void;
}

export interface StopwatchHandle {
	start: () => void;
	continueFromExisting: (existingStartTime?: Date) => void;
	stop: () => void;
	resume: () => void;
	reset: () => void;
	togglePause: () => void;
	expand: () => void;
	getState: () => StopwatchState;
	getBreakMinutes: () => number;
	isActive: () => boolean;
	exportState: () => StopwatchSnapshot;
	importState: (snapshot: StopwatchSnapshot) => void;
	destroy: () => void;
}

const InternalStateSchema = z.object({
	state: z.enum(STOPWATCH_STATES).default("idle"),
	startTime: z.date().nullable().default(null),
	breakStartTime: z.date().nullable().default(null),
	sessionStartTime: z.date().nullable().default(null),
	totalBreakMs: z.number().default(0),
});

type InternalState = z.infer<typeof InternalStateSchema>;

const INITIAL_STATE: InternalState = InternalStateSchema.parse({});

function applyPendingBreak(state: InternalState): number {
	if (state.state === "paused" && state.breakStartTime) {
		return state.totalBreakMs + (Date.now() - state.breakStartTime.getTime());
	}
	return state.totalBreakMs;
}

function msToBreakMinutes(ms: number): number {
	return Math.round((ms / 60000) * 100) / 100;
}

function btnClass(variant: string, hidden: boolean): string {
	const base = cls(`stopwatch-btn stopwatch-${variant}-btn`);
	return hidden ? `${base} prisma-hidden` : base;
}

export const Stopwatch = forwardRef<StopwatchHandle, StopwatchCallbacks>(function Stopwatch(
	{ onStart, onContinueRequested, onStop, onBreakUpdate },
	ref
) {
	const stateRef = useRef<InternalState>(INITIAL_STATE);
	const [, forceTick] = useReducer((n: number) => n + 1, 0);
	const [collapsed, setCollapsed] = useState(true);

	const callbacksRef = useRef({ onStart, onContinueRequested, onStop, onBreakUpdate });
	callbacksRef.current = { onStart, onContinueRequested, onStop, onBreakUpdate };

	const setInternalState = useCallback((updater: (prev: InternalState) => InternalState) => {
		stateRef.current = updater(stateRef.current);
		forceTick();
	}, []);

	const beginTracking = useCallback(() => {
		setInternalState((prev) => ({
			...prev,
			state: "running",
			sessionStartTime: new Date(),
			totalBreakMs: 0,
			breakStartTime: null,
		}));
	}, [setInternalState]);

	const start = useCallback(() => {
		if (stateRef.current.state === "running") return;
		const now = new Date();
		setInternalState((prev) => ({ ...prev, startTime: now }));
		callbacksRef.current.onStart(now);
		beginTracking();
	}, [beginTracking, setInternalState]);

	const continueFromExisting = useCallback(
		(existingStartTime?: Date) => {
			if (stateRef.current.state === "running") return;
			const candidate = existingStartTime ?? stateRef.current.startTime ?? new Date();
			// Refuse to track from a future start time — elapsed = now - start
			// would be negative, rendering as a "countdown" until that moment.
			if (candidate.getTime() > Date.now()) return;
			setInternalState((prev) => ({ ...prev, startTime: candidate }));
			beginTracking();
		},
		[beginTracking, setInternalState]
	);

	const togglePause = useCallback(() => {
		const current = stateRef.current;
		if (current.state === "running") {
			setInternalState((prev) => ({
				...prev,
				state: "paused",
				breakStartTime: new Date(),
			}));
		} else if (current.state === "paused") {
			const appliedBreakMs = applyPendingBreak(current);
			setInternalState((prev) => ({
				...prev,
				state: "running",
				totalBreakMs: appliedBreakMs,
				breakStartTime: null,
				sessionStartTime: new Date(),
			}));
			if (current.breakStartTime) {
				callbacksRef.current.onBreakUpdate(msToBreakMinutes(appliedBreakMs));
			}
		}
	}, [setInternalState]);

	const stop = useCallback(() => {
		const current = stateRef.current;
		if (current.state === "idle" || current.state === "stopped") return;

		const appliedBreakMs = applyPendingBreak(current);
		setInternalState((prev) => ({
			...prev,
			state: "stopped",
			totalBreakMs: appliedBreakMs,
			breakStartTime: null,
		}));

		callbacksRef.current.onStop(new Date());
		callbacksRef.current.onBreakUpdate(msToBreakMinutes(appliedBreakMs));
	}, [setInternalState]);

	const resume = useCallback(() => {
		if (stateRef.current.state !== "stopped") return;
		setInternalState((prev) => ({
			...prev,
			state: "running",
			sessionStartTime: new Date(),
		}));
	}, [setInternalState]);

	const reset = useCallback(() => {
		setInternalState(() => ({ ...INITIAL_STATE }));
	}, [setInternalState]);

	const expand = useCallback(() => {
		setCollapsed(false);
	}, []);

	const exportState = useCallback((): StopwatchSnapshot => {
		const s = stateRef.current;
		return {
			state: s.state,
			startTime: s.startTime?.getTime() ?? null,
			breakStartTime: s.breakStartTime?.getTime() ?? null,
			sessionStartTime: s.sessionStartTime?.getTime() ?? null,
			totalBreakMs: s.totalBreakMs,
		};
	}, []);

	const importState = useCallback(
		(snapshot: StopwatchSnapshot) => {
			let next: InternalState = {
				state: snapshot.state,
				startTime: snapshot.startTime ? new Date(snapshot.startTime) : null,
				breakStartTime: snapshot.breakStartTime ? new Date(snapshot.breakStartTime) : null,
				sessionStartTime: snapshot.sessionStartTime ? new Date(snapshot.sessionStartTime) : null,
				totalBreakMs: snapshot.totalBreakMs,
			};
			if (next.state === "running" && !next.sessionStartTime && next.startTime) {
				next = { ...next, sessionStartTime: next.startTime };
			}
			setInternalState(() => next);
			if (snapshot.state === "running" || snapshot.state === "paused") {
				setCollapsed(false);
			}
		},
		[setInternalState]
	);

	useImperativeHandle(
		ref,
		() => ({
			start,
			continueFromExisting,
			stop,
			resume,
			reset,
			togglePause,
			expand,
			getState: () => stateRef.current.state,
			getBreakMinutes: () => msToBreakMinutes(applyPendingBreak(stateRef.current)),
			isActive: () => {
				const s = stateRef.current.state;
				return s === "running" || s === "paused";
			},
			exportState,
			importState,
			destroy: () => {
				/* React unmount is owned by renderReactInline's returned unmount(); no-op for parity */
			},
		}),
		[continueFromExisting, exportState, expand, importState, reset, resume, start, stop, togglePause]
	);

	const current = stateRef.current;
	const isTickingState = current.state === "running" || current.state === "paused";

	useEffect(() => {
		if (!isTickingState) return;
		const id = window.setInterval(() => forceTick(), 1000);
		return () => window.clearInterval(id);
	}, [isTickingState]);

	const elapsedMs = current.startTime ? Date.now() - current.startTime.getTime() : 0;
	const currentBreakMs = applyPendingBreak(current);

	const showSessionTimer = current.state === "running" && current.sessionStartTime !== null;
	const showBreakTimer = current.state === "paused" && current.breakStartTime !== null;
	const showMid = showSessionTimer || showBreakTimer;
	let midLabel = "Session:";
	let midMs = 0;
	if (showSessionTimer && current.sessionStartTime) {
		midMs = Date.now() - current.sessionStartTime.getTime();
	} else if (showBreakTimer && current.breakStartTime) {
		midLabel = "Current break:";
		midMs = Date.now() - current.breakStartTime.getTime();
	}

	const isIdleOrStopped = current.state === "idle" || current.state === "stopped";
	const isRunningOrPaused = current.state === "running" || current.state === "paused";
	const isPaused = current.state === "paused";

	const startBtnHidden = !isIdleOrStopped;
	const continueBtnHidden = current.state !== "idle";
	const pauseBtnHidden = !isRunningOrPaused;
	const stopBtnHidden = !isRunningOrPaused;
	const resumeBtnHidden = current.state !== "stopped";

	const handleContinueClick = () => {
		const existing = callbacksRef.current.onContinueRequested();
		if (existing) {
			continueFromExisting(existing);
		}
	};

	const startBtnLabel = current.state === "stopped" ? "▶ start new" : "▶ start";
	const pauseBtnLabel = isPaused ? "▶ resume" : "⏸ break";

	return (
		<div className={cls("stopwatch-container")}>
			<CollapsibleSection
				cssPrefix={CSS_PREFIX}
				label="Time tracker"
				testIdSlug="time-tracker"
				collapsed={collapsed}
				onToggle={(next) => setCollapsed(next)}
			>
				<div className={cls("stopwatch-display-section")}>
					<div className={cls("stopwatch-main-display")}>
						<span className={cls("stopwatch-label")}>Total:</span>
						<span className={cls("stopwatch-time")} data-testid="prisma-stopwatch-time">
							{formatMsToHHMMSS(elapsedMs)}
						</span>
					</div>
					<div className={cls("stopwatch-break-display")}>
						<span className={cls("stopwatch-label")}>Total Break:</span>
						<span className={cls("stopwatch-break-time")}>{formatMsToHHMMSS(currentBreakMs)}</span>
					</div>
				</div>

				<div className={cls("stopwatch-controls")}>
					<button type="button" className={btnClass("start", startBtnHidden)} onClick={start}>
						{startBtnLabel}
					</button>
					<button type="button" className={btnClass("continue", continueBtnHidden)} onClick={handleContinueClick}>
						▶ continue
					</button>
					<button
						type="button"
						className={btnClass(isPaused ? "resume" : "pause", pauseBtnHidden)}
						onClick={togglePause}
					>
						{pauseBtnLabel}
					</button>
					<button type="button" className={btnClass("stop", stopBtnHidden)} onClick={stop}>
						⏹ stop
					</button>
					<button type="button" className={btnClass("resume", resumeBtnHidden)} onClick={resume}>
						▶ resume
					</button>
				</div>

				<div className={cls("stopwatch-mid-display-section")}>
					<div className={`${cls("stopwatch-mid-display")}${showMid ? "" : " prisma-hidden"}`}>
						<span className={cls("stopwatch-label")}>{midLabel}</span>
						<span className={cls("stopwatch-mid-time")}>{formatMsToHHMMSS(midMs)}</span>
					</div>
				</div>
			</CollapsibleSection>
		</div>
	);
});
