import { cls } from "@real1ty-obsidian-plugins";
import { formatMsToHHMMSS } from "../utils/time-formatter";

type StopwatchState = "idle" | "running" | "paused" | "stopped";

interface StopwatchCallbacks {
	onStart: (startTime: Date) => void;
	onStartWithoutFill: (startTime: Date) => void;
	onStop: (endTime: Date) => void;
	onBreakUpdate: (breakMinutes: number) => void;
}

export interface StopwatchSnapshot {
	state: StopwatchState;
	startTime: number | null;
	breakStartTime: number | null;
	sessionStartTime: number | null;
	totalBreakMs: number;
}

export class Stopwatch {
	private state: StopwatchState = "idle";
	private startTime: Date | null = null;
	private breakStartTime: Date | null = null;
	private sessionStartTime: Date | null = null;
	private totalBreakMs = 0;
	private intervalId: number | null = null;
	private isExpanded = false;

	private container: HTMLElement | null = null;
	private contentEl: HTMLElement | null = null;
	private toggleIcon: HTMLElement | null = null;
	private displayEl: HTMLElement | null = null;
	private breakDisplayEl: HTMLElement | null = null;
	private midContainer: HTMLElement | null = null;
	private midLabelEl: HTMLElement | null = null;
	private midDisplayEl: HTMLElement | null = null;
	private startBtn: HTMLButtonElement | null = null;
	private startWithoutFillBtn: HTMLButtonElement | null = null;
	private pauseBtn: HTMLButtonElement | null = null;
	private stopBtn: HTMLButtonElement | null = null;
	private resumeBtn: HTMLButtonElement | null = null;

	private callbacks: StopwatchCallbacks;
	private showStartWithoutFill: boolean;

	constructor(callbacks: StopwatchCallbacks, showStartWithoutFill: boolean) {
		this.callbacks = callbacks;
		this.showStartWithoutFill = showStartWithoutFill;
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
		header.createSpan({
			text: "Time tracker",
			cls: cls("stopwatch-header-text"),
		});

		// Collapsible content (hidden by default)
		this.contentEl = this.container.createDiv(cls("stopwatch-content"));
		this.contentEl.classList.add("prisma-hidden");

		// Timer display section
		const displaySection = this.contentEl.createDiv(cls("stopwatch-display-section"));

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

		// Start without fill button (conditional)
		if (this.showStartWithoutFill) {
			this.startWithoutFillBtn = controlsSection.createEl("button", {
				text: "▶ start (no fill)",
				cls: cls("stopwatch-btn stopwatch-start-without-fill-btn"),
				type: "button",
			});
			this.startWithoutFillBtn.addEventListener("click", () => {
				this.startWithoutFill();
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
		const midDisplaySection = this.contentEl.createDiv(cls("stopwatch-mid-display-section"));
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

		return this.container;
	}

	private toggleExpanded(): void {
		this.isExpanded = !this.isExpanded;
		if (this.contentEl && this.toggleIcon) {
			this.contentEl.classList.toggle("prisma-hidden", !this.isExpanded);
			this.toggleIcon.textContent = this.isExpanded ? "▼" : "▶";
		}
	}

	expand(): void {
		if (!this.isExpanded) {
			this.toggleExpanded();
		}
	}

	start(): void {
		this.startTracking(false);
	}

	startWithoutFill(): void {
		this.startTracking(true);
	}

	private startTracking(withoutFill: boolean): void {
		if (this.state === "running") return;

		this.state = "running";
		const now = new Date();
		this.startTime = now;
		this.sessionStartTime = now;
		this.totalBreakMs = 0;
		this.breakStartTime = null;

		if (withoutFill) {
			this.callbacks.onStartWithoutFill(this.startTime);
		} else {
			this.callbacks.onStart(this.startTime);
		}

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
		if (this.midContainer && this.midLabelEl && this.midDisplayEl) {
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
	}

	private updateButtonStates(): void {
		if (!this.startBtn || !this.pauseBtn || !this.stopBtn || !this.resumeBtn) return;

		switch (this.state) {
			case "idle":
				this.startBtn.classList.remove("prisma-hidden");
				this.startBtn.textContent = "▶ start";
				if (this.startWithoutFillBtn) {
					this.startWithoutFillBtn.classList.remove("prisma-hidden");
				}
				this.pauseBtn.classList.add("prisma-hidden");
				this.stopBtn.classList.add("prisma-hidden");
				this.resumeBtn.classList.add("prisma-hidden");
				break;

			case "running":
				this.startBtn.classList.add("prisma-hidden");
				if (this.startWithoutFillBtn) {
					this.startWithoutFillBtn.classList.add("prisma-hidden");
				}
				this.pauseBtn.classList.remove("prisma-hidden");
				this.pauseBtn.textContent = "⏸ break";
				this.pauseBtn.classList.remove(cls("stopwatch-resume-btn"));
				this.pauseBtn.classList.add(cls("stopwatch-pause-btn"));
				this.stopBtn.classList.remove("prisma-hidden");
				this.resumeBtn.classList.add("prisma-hidden");
				break;

			case "paused":
				this.startBtn.classList.add("prisma-hidden");
				if (this.startWithoutFillBtn) {
					this.startWithoutFillBtn.classList.add("prisma-hidden");
				}
				this.pauseBtn.classList.remove("prisma-hidden");
				this.pauseBtn.textContent = "▶ resume";
				this.pauseBtn.classList.remove(cls("stopwatch-pause-btn"));
				this.pauseBtn.classList.add(cls("stopwatch-resume-btn"));
				this.stopBtn.classList.remove("prisma-hidden");
				this.resumeBtn.classList.add("prisma-hidden");
				break;

			case "stopped":
				this.startBtn.classList.remove("prisma-hidden");
				this.startBtn.textContent = "▶ start new";
				if (this.startWithoutFillBtn) {
					this.startWithoutFillBtn.classList.remove("prisma-hidden");
					this.startWithoutFillBtn.textContent = "▶ start new (no fill)";
				}
				this.pauseBtn.classList.add("prisma-hidden");
				this.stopBtn.classList.add("prisma-hidden");
				this.resumeBtn.classList.remove("prisma-hidden");
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
