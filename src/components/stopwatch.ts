import { cls } from "@real1ty-obsidian-plugins/utils";
import { formatMsToHHMMSS, formatMsToMMSS } from "../utils/time-formatter";

export type StopwatchState = "idle" | "running" | "paused" | "stopped";

export interface StopwatchCallbacks {
	onStart: (startTime: Date) => void;
	onStop: (endTime: Date) => void;
	onBreakUpdate: (breakMinutes: number) => void;
}

export interface StopwatchSnapshot {
	state: StopwatchState;
	startTime: number | null;
	breakStartTime: number | null;
	totalBreakMs: number;
}

export class Stopwatch {
	private state: StopwatchState = "idle";
	private startTime: Date | null = null;
	private breakStartTime: Date | null = null;
	private totalBreakMs = 0;
	private intervalId: number | null = null;
	private isExpanded = false;

	private container: HTMLElement | null = null;
	private contentEl: HTMLElement | null = null;
	private toggleIcon: HTMLElement | null = null;
	private displayEl: HTMLElement | null = null;
	private breakDisplayEl: HTMLElement | null = null;
	private startBtn: HTMLButtonElement | null = null;
	private pauseBtn: HTMLButtonElement | null = null;
	private stopBtn: HTMLButtonElement | null = null;

	private callbacks: StopwatchCallbacks;

	constructor(callbacks: StopwatchCallbacks) {
		this.callbacks = callbacks;
	}

	render(parent: HTMLElement): HTMLElement {
		this.container = parent.createDiv(cls("stopwatch-container"));

		// Collapsible header
		const header = this.container.createDiv(cls("stopwatch-header"));
		header.addEventListener("click", () => {
			this.toggleExpanded();
		});

		this.toggleIcon = header.createSpan({
			text: "▶",
			cls: cls("stopwatch-toggle-icon"),
		});
		header.createSpan({ text: "Time tracker", cls: cls("stopwatch-header-text") });

		// Collapsible content (hidden by default)
		this.contentEl = this.container.createDiv(cls("stopwatch-content"));
		this.contentEl.classList.add("prisma-hidden");

		// Timer display section
		const displaySection = this.contentEl.createDiv(cls("stopwatch-display-section"));

		// Main elapsed time display
		const mainDisplay = displaySection.createDiv(cls("stopwatch-main-display"));
		mainDisplay.createSpan({ text: "Elapsed:", cls: cls("stopwatch-label") });
		this.displayEl = mainDisplay.createSpan({
			text: "00:00:00",
			cls: cls("stopwatch-time"),
		});

		// Break time display
		const breakDisplay = displaySection.createDiv(cls("stopwatch-break-display"));
		breakDisplay.createSpan({ text: "Break:", cls: cls("stopwatch-label") });
		this.breakDisplayEl = breakDisplay.createSpan({
			text: "00:00",
			cls: cls("stopwatch-break-time"),
		});

		// Controls section
		const controlsSection = this.contentEl.createDiv(cls("stopwatch-controls"));

		// Start button
		this.startBtn = controlsSection.createEl("button", {
			text: "▶ start",
			cls: cls("stopwatch-btn stopwatch-start-btn"),
			type: "button",
		});
		this.startBtn.addEventListener("click", () => {
			this.start();
		});

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

		return this.container;
	}

	private toggleExpanded(): void {
		this.isExpanded = !this.isExpanded;
		if (this.contentEl && this.toggleIcon) {
			this.contentEl.classList.toggle("prisma-hidden", !this.isExpanded);
			this.toggleIcon.textContent = this.isExpanded ? "▼" : "▶";
		}
	}

	start(): void {
		if (this.state === "running") return;

		this.state = "running";
		this.startTime = new Date();
		this.totalBreakMs = 0;
		this.breakStartTime = null;

		this.callbacks.onStart(this.startTime);

		this.updateButtonStates();
		this.startInterval();
	}

	private togglePause(): void {
		if (this.state === "running") {
			// Start break
			this.state = "paused";
			this.breakStartTime = new Date();
			this.updateButtonStates();
		} else if (this.state === "paused") {
			// End break
			this.state = "running";
			if (this.breakStartTime) {
				this.totalBreakMs += Date.now() - this.breakStartTime.getTime();
				this.breakStartTime = null;
				this.callbacks.onBreakUpdate(this.getBreakMinutes());
			}
			this.updateButtonStates();
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

	reset(): void {
		this.state = "idle";
		this.startTime = null;
		this.breakStartTime = null;
		this.totalBreakMs = 0;

		this.stopInterval();
		this.updateDisplay();
		this.updateButtonStates();
	}

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

	private updateDisplay(): void {
		if (!this.displayEl || !this.breakDisplayEl) return;

		// Elapsed time (total time since start, including breaks)
		if (this.startTime) {
			const elapsedMs = Date.now() - this.startTime.getTime();
			this.displayEl.textContent = formatMsToHHMMSS(elapsedMs);
		} else {
			this.displayEl.textContent = "00:00:00";
		}

		// Break time
		let currentBreakMs = this.totalBreakMs;
		if (this.state === "paused" && this.breakStartTime) {
			currentBreakMs += Date.now() - this.breakStartTime.getTime();
		}
		this.breakDisplayEl.textContent = formatMsToMMSS(currentBreakMs);
	}

	private updateButtonStates(): void {
		if (!this.startBtn || !this.pauseBtn || !this.stopBtn) return;

		switch (this.state) {
			case "idle":
				this.startBtn.classList.remove("prisma-hidden");
				this.startBtn.textContent = "▶ start";
				this.pauseBtn.classList.add("prisma-hidden");
				this.stopBtn.classList.add("prisma-hidden");
				break;

			case "running":
				this.startBtn.classList.add("prisma-hidden");
				this.pauseBtn.classList.remove("prisma-hidden");
				this.pauseBtn.textContent = "⏸ break";
				this.pauseBtn.classList.remove(cls("stopwatch-resume-btn"));
				this.pauseBtn.classList.add(cls("stopwatch-pause-btn"));
				this.stopBtn.classList.remove("prisma-hidden");
				break;

			case "paused":
				this.startBtn.classList.add("prisma-hidden");
				this.pauseBtn.classList.remove("prisma-hidden");
				this.pauseBtn.textContent = "▶ resume";
				this.pauseBtn.classList.remove(cls("stopwatch-pause-btn"));
				this.pauseBtn.classList.add(cls("stopwatch-resume-btn"));
				this.stopBtn.classList.remove("prisma-hidden");
				break;

			case "stopped":
				this.startBtn.classList.remove("prisma-hidden");
				this.startBtn.textContent = "▶ start new";
				this.pauseBtn.classList.add("prisma-hidden");
				this.stopBtn.classList.add("prisma-hidden");
				break;
		}
	}

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
			totalBreakMs: this.totalBreakMs,
		};
	}

	importState(snapshot: StopwatchSnapshot): void {
		this.state = snapshot.state;
		this.startTime = snapshot.startTime ? new Date(snapshot.startTime) : null;
		this.breakStartTime = snapshot.breakStartTime ? new Date(snapshot.breakStartTime) : null;
		this.totalBreakMs = snapshot.totalBreakMs;

		this.updateDisplay();
		this.updateButtonStates();

		// If the stopwatch was running or paused, restart the interval
		if (this.state === "running" || this.state === "paused") {
			this.startInterval();
			if (!this.isExpanded) {
				this.toggleExpanded();
			}
		}
	}

	destroy(): void {
		this.stopInterval();
		if (this.container) {
			this.container.remove();
		}
	}
}
