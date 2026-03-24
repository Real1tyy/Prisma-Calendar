import {
	cls,
	type CollapsibleSectionHandle,
	formatMsToHHMMSS,
	renderCollapsibleSection,
} from "@real1ty-obsidian-plugins";

import { CSS_PREFIX } from "../constants";
import type { StopwatchSnapshot, StopwatchState } from "../types/stopwatch";

interface StopwatchCallbacks {
	onStart: (startTime: Date) => void;
	onContinueRequested: () => Date | null;
	onStop: (endTime: Date) => void;
	onBreakUpdate: (breakMinutes: number) => void;
}

export class Stopwatch {
	private state: StopwatchState = "idle";
	private startTime: Date | null = null;
	private breakStartTime: Date | null = null;
	private sessionStartTime: Date | null = null;
	private totalBreakMs = 0;
	private intervalId: number | null = null;
	private container!: HTMLElement;
	private collapsibleHandle!: CollapsibleSectionHandle;
	private displayEl!: HTMLElement;
	private breakDisplayEl!: HTMLElement;
	private midContainer!: HTMLElement;
	private midLabelEl!: HTMLElement;
	private midDisplayEl!: HTMLElement;
	private startBtn!: HTMLButtonElement;
	private continueBtn: HTMLButtonElement | null = null;
	private pauseBtn!: HTMLButtonElement;
	private stopBtn!: HTMLButtonElement;
	private resumeBtn!: HTMLButtonElement;

	private callbacks: StopwatchCallbacks;
	private showContinueButton: boolean;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(callbacks: StopwatchCallbacks, showContinueButton: boolean) {
		this.callbacks = callbacks;
		this.showContinueButton = showContinueButton;
	}

	render(parent: HTMLElement): HTMLElement {
		this.container = parent.createDiv(cls("stopwatch-container"));

		this.collapsibleHandle = renderCollapsibleSection(this.container, {
			cssPrefix: CSS_PREFIX,
			label: "Time tracker",
			startCollapsed: true,
			renderBody: (body) => this.renderBody(body),
		});

		return this.container;
	}

	private renderBody(contentEl: HTMLElement): void {
		// Timer display section
		const displaySection = contentEl.createDiv(cls("stopwatch-display-section"));

		// Main elapsed time display
		const mainDisplay = displaySection.createDiv(cls("stopwatch-main-display"));
		mainDisplay.createSpan({ text: "Total:", cls: cls("stopwatch-label") });
		this.displayEl = mainDisplay.createSpan({
			text: "00:00:00",
			cls: cls("stopwatch-time"),
		});

		// Break time display
		const breakDisplay = displaySection.createDiv(cls("stopwatch-break-display"));
		breakDisplay.createSpan({
			text: "Total Break:",
			cls: cls("stopwatch-label"),
		});
		this.breakDisplayEl = breakDisplay.createSpan({
			text: "00:00:00",
			cls: cls("stopwatch-break-time"),
		});

		// Controls section
		const controlsSection = contentEl.createDiv(cls("stopwatch-controls"));

		// Start button
		this.startBtn = controlsSection.createEl("button", {
			text: "▶ start",
			cls: cls("stopwatch-btn stopwatch-start-btn"),
			type: "button",
		});
		this.startBtn.addEventListener("click", () => {
			this.start();
		});

		// Continue button (conditional) - continues from existing start time
		if (this.showContinueButton) {
			this.continueBtn = controlsSection.createEl("button", {
				text: "▶ continue",
				cls: cls("stopwatch-btn stopwatch-continue-btn"),
				type: "button",
			});
			this.continueBtn.addEventListener("click", () => {
				const existingStartTime = this.callbacks.onContinueRequested();
				if (existingStartTime) {
					this.continueFromExisting(existingStartTime);
				}
			});
		}

		// Pause/Resume button
		this.pauseBtn = controlsSection.createEl("button", {
			text: "⏸ break",
			cls: cls("stopwatch-btn stopwatch-pause-btn"),
			type: "button",
		});
		this.pauseBtn.classList.add("prisma-hidden");
		this.pauseBtn.addEventListener("click", () => {
			this.togglePause();
		});

		// Stop button
		this.stopBtn = controlsSection.createEl("button", {
			text: "⏹ stop",
			cls: cls("stopwatch-btn stopwatch-stop-btn"),
			type: "button",
		});
		this.stopBtn.classList.add("prisma-hidden");
		this.stopBtn.addEventListener("click", () => {
			this.stop();
		});

		// Resume button (shown after stop)
		this.resumeBtn = controlsSection.createEl("button", {
			text: "▶ resume",
			cls: cls("stopwatch-btn stopwatch-resume-btn"),
			type: "button",
		});
		this.resumeBtn.classList.add("prisma-hidden");
		this.resumeBtn.addEventListener("click", () => {
			this.resume();
		});

		// Mid display (shows Session when running, Current Break when paused) - at bottom
		const midDisplaySection = contentEl.createDiv(cls("stopwatch-mid-display-section"));
		this.midContainer = midDisplaySection.createDiv(cls("stopwatch-mid-display"));
		this.midLabelEl = this.midContainer.createSpan({
			text: "Session:",
			cls: cls("stopwatch-label"),
		});
		this.midDisplayEl = this.midContainer.createSpan({
			text: "00:00:00",
			cls: cls("stopwatch-mid-time"),
		});
		this.midContainer.classList.add("prisma-hidden");
	}

	expand(): void {
		this.collapsibleHandle.expand();
	}

	destroy(): void {
		this.stopInterval();
		this.container.remove();
	}

	// ─── Timer Control ────────────────────────────────────────────

	start(): void {
		if (this.state === "running") return;

		const now = new Date();
		this.startTime = now;
		this.callbacks.onStart(this.startTime);

		this.beginTracking();
	}

	continueFromExisting(existingStartTime?: Date): void {
		if (this.state === "running") return;

		// If an existing start time is provided, use it (continue from that point)
		// Otherwise, keep the current startTime if it exists, or fallback to now
		if (existingStartTime) {
			this.startTime = existingStartTime;
		} else if (!this.startTime) {
			this.startTime = new Date();
		}

		this.beginTracking();
	}

	private beginTracking(): void {
		this.state = "running";
		this.sessionStartTime = new Date();
		this.totalBreakMs = 0;
		this.breakStartTime = null;

		this.updateButtonStates();
		this.updateDisplay();
		this.startInterval();
	}

	private togglePause(): void {
		if (this.state === "running") {
			this.state = "paused";
			this.breakStartTime = new Date();
			this.updateButtonStates();
			this.updateDisplay();
		} else if (this.state === "paused") {
			this.state = "running";
			if (this.breakStartTime) {
				this.totalBreakMs += Date.now() - this.breakStartTime.getTime();
				this.breakStartTime = null;
				this.callbacks.onBreakUpdate(this.getBreakMinutes());
			}
			this.sessionStartTime = new Date();
			this.updateButtonStates();
			this.updateDisplay();
		}
	}

	stop(): void {
		if (this.state === "idle" || this.state === "stopped") return;

		// If paused, add remaining break time
		if (this.state === "paused" && this.breakStartTime) {
			this.totalBreakMs += Date.now() - this.breakStartTime.getTime();
			this.breakStartTime = null;
		}

		this.state = "stopped";
		const endTime = new Date();

		this.stopInterval();
		this.callbacks.onStop(endTime);
		this.callbacks.onBreakUpdate(this.getBreakMinutes());

		this.updateButtonStates();
	}

	resume(): void {
		if (this.state !== "stopped") return;

		this.state = "running";
		this.sessionStartTime = new Date();

		this.startInterval();
		this.updateButtonStates();
		this.updateDisplay();
	}

	reset(): void {
		this.state = "idle";
		this.startTime = null;
		this.breakStartTime = null;
		this.sessionStartTime = null;
		this.totalBreakMs = 0;

		this.stopInterval();
		this.updateDisplay();
		this.updateButtonStates();
	}

	// ─── Tick Loop ────────────────────────────────────────────────

	private startInterval(): void {
		this.stopInterval();
		this.intervalId = window.setInterval(() => {
			this.updateDisplay();
		}, 1000);
	}

	private stopInterval(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	// ─── Rendering ────────────────────────────────────────────────

	private updateDisplay(): void {
		// Total elapsed time (total time since start, including breaks)
		if (this.startTime) {
			const elapsedMs = Date.now() - this.startTime.getTime();
			this.displayEl.textContent = formatMsToHHMMSS(elapsedMs);
		} else {
			this.displayEl.textContent = "00:00:00";
		}

		// Total break time
		let currentBreakMs = this.totalBreakMs;
		if (this.state === "paused" && this.breakStartTime) {
			currentBreakMs += Date.now() - this.breakStartTime.getTime();
		}
		this.breakDisplayEl.textContent = formatMsToHHMMSS(currentBreakMs);

		// Mid timer (shows Session when running, Current Break when paused)
		if (this.state === "running" && this.sessionStartTime) {
			const sessionMs = Date.now() - this.sessionStartTime.getTime();
			this.midLabelEl.textContent = "Session:";
			this.midDisplayEl.textContent = formatMsToHHMMSS(sessionMs);
			this.midContainer.classList.remove("prisma-hidden");
		} else if (this.state === "paused" && this.breakStartTime) {
			const breakMs = Date.now() - this.breakStartTime.getTime();
			this.midLabelEl.textContent = "Current break:";
			this.midDisplayEl.textContent = formatMsToHHMMSS(breakMs);
			this.midContainer.classList.remove("prisma-hidden");
		} else {
			this.midContainer.classList.add("prisma-hidden");
		}
	}

	private updateButtonStates(): void {
		const HIDDEN = "prisma-hidden";
		const isIdleOrStopped = this.state === "idle" || this.state === "stopped";
		const isRunningOrPaused = this.state === "running" || this.state === "paused";

		this.startBtn.classList.toggle(HIDDEN, !isIdleOrStopped);
		this.startBtn.textContent = this.state === "stopped" ? "▶ start new" : "▶ start";

		if (this.continueBtn) {
			this.continueBtn.classList.toggle(HIDDEN, !isIdleOrStopped);
			this.continueBtn.textContent = "▶ continue";
		}

		this.pauseBtn.classList.toggle(HIDDEN, !isRunningOrPaused);
		this.pauseBtn.textContent = this.state === "paused" ? "▶ resume" : "⏸ break";
		this.pauseBtn.classList.toggle(cls("stopwatch-pause-btn"), this.state === "running");
		this.pauseBtn.classList.toggle(cls("stopwatch-resume-btn"), this.state === "paused");

		this.stopBtn.classList.toggle(HIDDEN, !isRunningOrPaused);
		this.resumeBtn.classList.toggle(HIDDEN, this.state !== "stopped");
	}

	// ─── Public Query API ──────────────────────────────────────────

	getBreakMinutes(): number {
		let totalBreakMs = this.totalBreakMs;
		if (this.state === "paused" && this.breakStartTime) {
			totalBreakMs += Date.now() - this.breakStartTime.getTime();
		}
		// Return as decimal minutes with 2 decimal places
		return Math.round((totalBreakMs / 60000) * 100) / 100;
	}

	getState(): StopwatchState {
		return this.state;
	}

	isActive(): boolean {
		return this.state === "running" || this.state === "paused";
	}

	exportState(): StopwatchSnapshot {
		return {
			state: this.state,
			startTime: this.startTime?.getTime() ?? null,
			breakStartTime: this.breakStartTime?.getTime() ?? null,
			sessionStartTime: this.sessionStartTime?.getTime() ?? null,
			totalBreakMs: this.totalBreakMs,
		};
	}

	importState(snapshot: StopwatchSnapshot): void {
		this.state = snapshot.state;
		this.startTime = snapshot.startTime ? new Date(snapshot.startTime) : null;
		this.breakStartTime = snapshot.breakStartTime ? new Date(snapshot.breakStartTime) : null;
		this.sessionStartTime = snapshot.sessionStartTime ? new Date(snapshot.sessionStartTime) : null;
		this.totalBreakMs = snapshot.totalBreakMs;

		if (this.state === "running" && !this.sessionStartTime && this.startTime) {
			this.sessionStartTime = this.startTime;
		}

		this.updateDisplay();
		this.updateButtonStates();

		// If the stopwatch was running or paused, restart the interval
		if (this.state === "running" || this.state === "paused") {
			this.startInterval();
			this.collapsibleHandle.expand();
		}
	}
}
