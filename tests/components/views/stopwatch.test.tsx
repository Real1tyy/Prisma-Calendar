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

describe("Stopwatch", () => {
	let mockCallbacks: {
		onStart: ReturnType<typeof vi.fn>;
		onContinueRequested: ReturnType<typeof vi.fn>;
		onStop: ReturnType<typeof vi.fn>;
		onBreakUpdate: ReturnType<typeof vi.fn>;
	};

	function mountStopwatch(): { stopwatch: StopwatchHandle; unmount: () => void } {
		const ref = createRef<StopwatchHandle | null>();
		const { unmount } = render(
			<Stopwatch
				ref={ref}
				onStart={mockCallbacks.onStart}
				onContinueRequested={mockCallbacks.onContinueRequested}
				onStop={mockCallbacks.onStop}
				onBreakUpdate={mockCallbacks.onBreakUpdate}
			/>
		);
		return { stopwatch: ref.current!, unmount };
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
			vi.advanceTimersByTime(1000);
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

			vi.advanceTimersByTime(60000);
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
			vi.advanceTimersByTime(30000);
			drive(() => stopwatch.togglePause());

			const firstBreakTime = stopwatch.getBreakMinutes();

			drive(() => stopwatch.togglePause());
			vi.advanceTimersByTime(30000);
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
			vi.advanceTimersByTime(60000);

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
			vi.advanceTimersByTime(60000);

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
});
