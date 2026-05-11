import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Stopwatch, type StopwatchHandle } from "../../../src/react/views/stopwatch";

// Wraps an imperative-handle call in act() so React state updates flush before
// the next assertion.
function drive(fn: () => void): void {
	act(() => {
		fn();
	});
}

// Stopwatch installs a 1s interval that calls forceTick() while ticking;
// advancing fake timers fires it, so the resulting re-renders must run inside act().
function advanceTimers(ms: number): void {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

describe("Stopwatch", () => {
	let mockCallbacks: {
		onStart: ReturnType<typeof vi.fn>;
		onContinueRequested: ReturnType<typeof vi.fn>;
		onStop: ReturnType<typeof vi.fn>;
		onBreakUpdate: ReturnType<typeof vi.fn>;
	};

	function mountStopwatch(): {
		stopwatch: StopwatchHandle;
		container: HTMLElement;
		unmount: () => void;
	} {
		const ref = createRef<StopwatchHandle | null>();
		const { container, unmount } = render(
			<Stopwatch
				ref={ref}
				onStart={mockCallbacks.onStart}
				onContinueRequested={mockCallbacks.onContinueRequested}
				onStop={mockCallbacks.onStop}
				onBreakUpdate={mockCallbacks.onBreakUpdate}
			/>
		);
		return { stopwatch: ref.current!, container, unmount };
	}

	function isVisible(container: HTMLElement, variant: string): boolean {
		const btn = container.querySelector(`.prisma-stopwatch-${variant}-btn`);
		if (!btn) throw new Error(`Button .prisma-stopwatch-${variant}-btn not in DOM`);
		return !btn.classList.contains("prisma-hidden");
	}

	beforeEach(() => {
		mockCallbacks = {
			onStart: vi.fn(),
			onContinueRequested: vi.fn(() => new Date()),
			onStop: vi.fn(),
			onBreakUpdate: vi.fn(),
		};
	});

	describe("Basic functionality", () => {
		it("should start in idle state", () => {
			const { stopwatch } = mountStopwatch();
			expect(stopwatch.getState()).toBe("idle");
			expect(stopwatch.isActive()).toBe(false);
		});

		it("should transition to running state when started", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.isActive()).toBe(true);
			expect(mockCallbacks.onStart).toHaveBeenCalledWith(expect.any(Date));
		});

		it("should continue from existing start time", () => {
			const { stopwatch } = mountStopwatch();
			const existingStartTime = new Date(Date.now() - 3600000); // 1 hour ago
			mockCallbacks.onContinueRequested.mockReturnValue(existingStartTime);

			drive(() => stopwatch.continueFromExisting(existingStartTime));
			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.isActive()).toBe(true);

			// Verify onContinueRequested was not called since we provided the start time directly
			expect(mockCallbacks.onContinueRequested).not.toHaveBeenCalled();
		});

		it("should refuse to continue from a future start time", () => {
			const { stopwatch } = mountStopwatch();
			const futureStartTime = new Date(Date.now() + 60_000); // 1 minute from now

			drive(() => stopwatch.continueFromExisting(futureStartTime));
			expect(stopwatch.getState()).toBe("idle");
			expect(stopwatch.isActive()).toBe(false);
		});

		it("should transition to stopped state when stopped", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.stop());
			expect(stopwatch.getState()).toBe("stopped");
			expect(stopwatch.isActive()).toBe(false);
			expect(mockCallbacks.onStop).toHaveBeenCalledWith(expect.any(Date));
		});
	});

	describe("Resume functionality", () => {
		it("should resume from stopped state", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.stop());
			expect(stopwatch.getState()).toBe("stopped");

			drive(() => stopwatch.resume());
			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.isActive()).toBe(true);
		});

		it("should not call onStart when resuming", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			mockCallbacks.onStart.mockClear();

			drive(() => stopwatch.stop());
			drive(() => stopwatch.resume());

			expect(mockCallbacks.onStart).not.toHaveBeenCalled();
		});

		it("should continue tracking time after resume", () => {
			vi.useFakeTimers();
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			advanceTimers(1000);
			drive(() => stopwatch.stop());

			const stateBeforeResume = stopwatch.exportState();
			drive(() => stopwatch.resume());

			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.exportState().startTime).toBe(stateBeforeResume.startTime);
			vi.useRealTimers();
		});

		it("should not resume from idle state", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.resume());
			expect(stopwatch.getState()).toBe("idle");
		});

		it("should not resume from running state", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.resume());
			expect(stopwatch.getState()).toBe("running");
		});

		it("should not resume from paused state", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.togglePause());
			expect(stopwatch.getState()).toBe("paused");

			drive(() => stopwatch.resume());
			expect(stopwatch.getState()).toBe("paused");
		});
	});

	describe("Break tracking", () => {
		it("should track break time", () => {
			vi.useFakeTimers();
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.togglePause());
			expect(stopwatch.getState()).toBe("paused");

			advanceTimers(60000);
			expect(stopwatch.getBreakMinutes()).toBeGreaterThan(0);
			vi.useRealTimers();
		});

		it("should resume from break", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.togglePause());
			expect(stopwatch.getState()).toBe("paused");

			drive(() => stopwatch.togglePause());
			expect(stopwatch.getState()).toBe("running");
			expect(mockCallbacks.onBreakUpdate).toHaveBeenCalled();
		});

		it("should accumulate break time across multiple breaks", () => {
			vi.useFakeTimers();
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());

			drive(() => stopwatch.togglePause());
			advanceTimers(30000);
			drive(() => stopwatch.togglePause());

			const firstBreakTime = stopwatch.getBreakMinutes();

			drive(() => stopwatch.togglePause());
			advanceTimers(30000);
			drive(() => stopwatch.togglePause());

			const totalBreakTime = stopwatch.getBreakMinutes();
			expect(totalBreakTime).toBeGreaterThan(firstBreakTime);
			vi.useRealTimers();
		});
	});

	describe("State export and import", () => {
		it("should export current state", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			const state = stopwatch.exportState();

			expect(state.state).toBe("running");
			expect(state.startTime).toBeTypeOf("number");
			expect(state.totalBreakMs).toBe(0);
		});

		it("should import and restore state", () => {
			const { stopwatch: originalStopwatch, unmount: unmountOriginal } = mountStopwatch();
			drive(() => originalStopwatch.start());

			const state = originalStopwatch.exportState();

			const { stopwatch: newStopwatch } = mountStopwatch();
			drive(() => newStopwatch.importState(state));

			expect(newStopwatch.getState()).toBe("running");
			expect(newStopwatch.isActive()).toBe(true);
			unmountOriginal();
		});

		it("should preserve break time when importing state", () => {
			vi.useFakeTimers();
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.togglePause());
			advanceTimers(60000);

			const state = stopwatch.exportState();
			const { stopwatch: newStopwatch } = mountStopwatch();
			drive(() => newStopwatch.importState(state));

			expect(newStopwatch.getBreakMinutes()).toBeGreaterThan(0);
			vi.useRealTimers();
		});
	});

	describe("Reset functionality", () => {
		it("should reset to idle state", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.reset());

			expect(stopwatch.getState()).toBe("idle");
			expect(stopwatch.isActive()).toBe(false);
			expect(stopwatch.getBreakMinutes()).toBe(0);
		});

		it("should clear break time on reset", () => {
			vi.useFakeTimers();
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.togglePause());
			advanceTimers(60000);

			drive(() => stopwatch.reset());
			expect(stopwatch.getBreakMinutes()).toBe(0);
			vi.useRealTimers();
		});
	});

	describe("Edge cases", () => {
		it("should not stop when already stopped", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.stop());
			mockCallbacks.onStop.mockClear();

			drive(() => stopwatch.stop());
			expect(mockCallbacks.onStop).not.toHaveBeenCalled();
		});

		it("should not stop when idle", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.stop());
			expect(mockCallbacks.onStop).not.toHaveBeenCalled();
		});

		it("should not start when already running", () => {
			const { stopwatch } = mountStopwatch();
			drive(() => stopwatch.start());
			mockCallbacks.onStart.mockClear();

			drive(() => stopwatch.start());
			expect(mockCallbacks.onStart).not.toHaveBeenCalled();
		});
	});

	describe("Button visibility", () => {
		it("idle: shows start + continue, hides pause/stop/resume", () => {
			const { container } = mountStopwatch();
			expect(isVisible(container, "start")).toBe(true);
			expect(isVisible(container, "continue")).toBe(true);
			expect(isVisible(container, "pause")).toBe(false);
			expect(isVisible(container, "stop")).toBe(false);
			expect(isVisible(container, "resume")).toBe(false);
		});

		it("running: shows pause + stop, hides start/continue/resume", () => {
			const { stopwatch, container } = mountStopwatch();
			drive(() => stopwatch.start());
			expect(isVisible(container, "start")).toBe(false);
			expect(isVisible(container, "continue")).toBe(false);
			expect(isVisible(container, "pause")).toBe(true);
			expect(isVisible(container, "stop")).toBe(true);
			expect(isVisible(container, "resume")).toBe(false);
		});

		it("paused: shows pause-as-resume + stop, hides start/continue/standalone-resume", () => {
			const { stopwatch, container } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.togglePause());
			expect(isVisible(container, "start")).toBe(false);
			expect(isVisible(container, "continue")).toBe(false);
			expect(isVisible(container, "stop")).toBe(true);
			// The pause toggle swaps its class to .prisma-stopwatch-resume-btn in
			// the paused branch — query that one instead. The "standalone" resume
			// (visible only after stop) remains hidden, so two .resume-btn nodes
			// exist; we need the one that is currently visible.
			const resumeBtns = container.querySelectorAll(".prisma-stopwatch-resume-btn");
			const visibleResume = Array.from(resumeBtns).find((el) => !el.classList.contains("prisma-hidden"));
			expect(visibleResume).toBeDefined();
		});

		it("stopped: shows start-new + standalone resume, hides continue/pause/stop", () => {
			const { stopwatch, container } = mountStopwatch();
			drive(() => stopwatch.start());
			drive(() => stopwatch.stop());
			expect(isVisible(container, "start")).toBe(true);
			// Regression guard: continue is NOT shown in stopped state. It would
			// silently wipe the accumulated break tally on click (continueFromExisting
			// → beginTracking() zeroes totalBreakMs). Use resume to restart instead.
			expect(isVisible(container, "continue")).toBe(false);
			expect(isVisible(container, "pause")).toBe(false);
			expect(isVisible(container, "stop")).toBe(false);
			// The standalone resume button (last in DOM order) becomes visible here.
			const resumeBtns = container.querySelectorAll(".prisma-stopwatch-resume-btn");
			const visibleResume = Array.from(resumeBtns).find((el) => !el.classList.contains("prisma-hidden"));
			expect(visibleResume).toBeDefined();
		});
	});
});
