import { beforeEach, describe, expect, it, vi } from "vitest";
import { Stopwatch } from "../../src/components/stopwatch";

function setupObsidianDOMHelpers(element: HTMLElement) {
	(element as any).createDiv = function (options?: any) {
		const div = document.createElement("div");
		if (options?.cls) {
			if (typeof options.cls === "string") {
				div.className = options.cls;
			}
		}
		if (options?.text) {
			div.textContent = options.text;
		}
		this.appendChild(div);
		setupObsidianDOMHelpers(div);
		return div;
	};

	(element as any).createEl = function (tag: string, options?: any) {
		const el = document.createElement(tag);
		if (options?.cls) {
			if (typeof options.cls === "string") {
				el.className = options.cls;
			}
		}
		if (options?.text) {
			el.textContent = options.text;
		}
		if (options?.type) {
			(el as any).type = options.type;
		}
		this.appendChild(el);
		setupObsidianDOMHelpers(el);
		return el;
	};

	(element as any).createSpan = function (options?: any) {
		const span = document.createElement("span");
		if (options?.cls) {
			if (typeof options.cls === "string") {
				span.className = options.cls;
			}
		}
		if (options?.text) {
			span.textContent = options.text;
		}
		this.appendChild(span);
		setupObsidianDOMHelpers(span);
		return span;
	};
}

describe("Stopwatch", () => {
	let stopwatch: Stopwatch;
	let mockCallbacks: {
		onStart: ReturnType<typeof vi.fn>;
		onStartWithoutFill: ReturnType<typeof vi.fn>;
		onStop: ReturnType<typeof vi.fn>;
		onBreakUpdate: ReturnType<typeof vi.fn>;
	};
	let container: HTMLElement;

	beforeEach(() => {
		mockCallbacks = {
			onStart: vi.fn(),
			onStartWithoutFill: vi.fn(),
			onStop: vi.fn(),
			onBreakUpdate: vi.fn(),
		};

		stopwatch = new Stopwatch(mockCallbacks, true);
		container = document.createElement("div");
		setupObsidianDOMHelpers(container);
		stopwatch.render(container);
	});

	describe("Basic functionality", () => {
		it("should start in idle state", () => {
			expect(stopwatch.getState()).toBe("idle");
			expect(stopwatch.isActive()).toBe(false);
		});

		it("should transition to running state when started", () => {
			stopwatch.start();
			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.isActive()).toBe(true);
			expect(mockCallbacks.onStart).toHaveBeenCalledWith(expect.any(Date));
		});

		it("should call onStartWithoutFill when starting without fill", () => {
			stopwatch.startWithoutFill();
			expect(stopwatch.getState()).toBe("running");
			expect(mockCallbacks.onStartWithoutFill).toHaveBeenCalledWith(expect.any(Date));
		});

		it("should transition to stopped state when stopped", () => {
			stopwatch.start();
			stopwatch.stop();
			expect(stopwatch.getState()).toBe("stopped");
			expect(stopwatch.isActive()).toBe(false);
			expect(mockCallbacks.onStop).toHaveBeenCalledWith(expect.any(Date));
		});
	});

	describe("Resume functionality", () => {
		it("should resume from stopped state", () => {
			stopwatch.start();
			stopwatch.stop();
			expect(stopwatch.getState()).toBe("stopped");

			stopwatch.resume();
			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.isActive()).toBe(true);
		});

		it("should not call onStart when resuming", () => {
			stopwatch.start();
			mockCallbacks.onStart.mockClear();

			stopwatch.stop();
			stopwatch.resume();

			expect(mockCallbacks.onStart).not.toHaveBeenCalled();
		});

		it("should continue tracking time after resume", () => {
			vi.useFakeTimers();
			stopwatch.start();
			vi.advanceTimersByTime(1000);
			stopwatch.stop();

			const stateBeforeResume = stopwatch.exportState();
			stopwatch.resume();

			expect(stopwatch.getState()).toBe("running");
			expect(stopwatch.exportState().startTime).toBe(stateBeforeResume.startTime);
			vi.useRealTimers();
		});

		it("should not resume from idle state", () => {
			stopwatch.resume();
			expect(stopwatch.getState()).toBe("idle");
		});

		it("should not resume from running state", () => {
			stopwatch.start();
			stopwatch.resume();
			expect(stopwatch.getState()).toBe("running");
		});

		it("should not resume from paused state", () => {
			stopwatch.start();
			// Simulate pause by accessing private method through type assertion
			(stopwatch as any).togglePause();
			expect(stopwatch.getState()).toBe("paused");

			stopwatch.resume();
			expect(stopwatch.getState()).toBe("paused");
		});
	});

	describe("Break tracking", () => {
		it("should track break time", () => {
			vi.useFakeTimers();
			stopwatch.start();
			(stopwatch as any).togglePause();
			expect(stopwatch.getState()).toBe("paused");

			vi.advanceTimersByTime(60000);
			expect(stopwatch.getBreakMinutes()).toBeGreaterThan(0);
			vi.useRealTimers();
		});

		it("should resume from break", () => {
			stopwatch.start();
			(stopwatch as any).togglePause();
			expect(stopwatch.getState()).toBe("paused");

			(stopwatch as any).togglePause();
			expect(stopwatch.getState()).toBe("running");
			expect(mockCallbacks.onBreakUpdate).toHaveBeenCalled();
		});

		it("should accumulate break time across multiple breaks", () => {
			vi.useFakeTimers();
			stopwatch.start();

			(stopwatch as any).togglePause();
			vi.advanceTimersByTime(30000);
			(stopwatch as any).togglePause();

			const firstBreakTime = stopwatch.getBreakMinutes();

			(stopwatch as any).togglePause();
			vi.advanceTimersByTime(30000);
			(stopwatch as any).togglePause();

			const totalBreakTime = stopwatch.getBreakMinutes();
			expect(totalBreakTime).toBeGreaterThan(firstBreakTime);
			vi.useRealTimers();
		});
	});

	describe("State export and import", () => {
		it("should export current state", () => {
			stopwatch.start();
			const state = stopwatch.exportState();

			expect(state.state).toBe("running");
			expect(state.startTime).toBeTypeOf("number");
			expect(state.totalBreakMs).toBe(0);
		});

		it("should import and restore state", () => {
			const originalStopwatch = new Stopwatch(mockCallbacks, true);
			originalStopwatch.render(container);
			originalStopwatch.start();

			const state = originalStopwatch.exportState();

			const newStopwatch = new Stopwatch(mockCallbacks, true);
			newStopwatch.render(container);
			newStopwatch.importState(state);

			expect(newStopwatch.getState()).toBe("running");
			expect(newStopwatch.isActive()).toBe(true);
		});

		it("should preserve break time when importing state", () => {
			vi.useFakeTimers();
			stopwatch.start();
			(stopwatch as any).togglePause();
			vi.advanceTimersByTime(60000);

			const state = stopwatch.exportState();
			const newStopwatch = new Stopwatch(mockCallbacks, true);
			const newContainer = document.createElement("div");
			setupObsidianDOMHelpers(newContainer);
			newStopwatch.render(newContainer);
			newStopwatch.importState(state);

			expect(newStopwatch.getBreakMinutes()).toBeGreaterThan(0);
			vi.useRealTimers();
		});
	});

	describe("Reset functionality", () => {
		it("should reset to idle state", () => {
			stopwatch.start();
			stopwatch.reset();

			expect(stopwatch.getState()).toBe("idle");
			expect(stopwatch.isActive()).toBe(false);
			expect(stopwatch.getBreakMinutes()).toBe(0);
		});

		it("should clear break time on reset", () => {
			vi.useFakeTimers();
			stopwatch.start();
			(stopwatch as any).togglePause();
			vi.advanceTimersByTime(60000);

			stopwatch.reset();
			expect(stopwatch.getBreakMinutes()).toBe(0);
			vi.useRealTimers();
		});
	});

	describe("Edge cases", () => {
		it("should not stop when already stopped", () => {
			stopwatch.start();
			stopwatch.stop();
			mockCallbacks.onStop.mockClear();

			stopwatch.stop();
			expect(mockCallbacks.onStop).not.toHaveBeenCalled();
		});

		it("should not stop when idle", () => {
			stopwatch.stop();
			expect(mockCallbacks.onStop).not.toHaveBeenCalled();
		});

		it("should not start when already running", () => {
			stopwatch.start();
			mockCallbacks.onStart.mockClear();

			stopwatch.start();
			expect(mockCallbacks.onStart).not.toHaveBeenCalled();
		});
	});
});
