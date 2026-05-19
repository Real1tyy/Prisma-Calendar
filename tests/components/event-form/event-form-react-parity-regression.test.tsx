/**
 * Regression tests for the imperative → React event-modal migration.
 * Each test pins a behaviour that diverged during the port; see
 * docs/specs/2026-05-15-event-modal-react-migration-parity.md for the
 * one-to-one mapping between test names and finding numbers (#4…#11).
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Notice } from "obsidian";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../../src/core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../../src/core/minimized-modal-manager";
import { EventForm, type EventFormValues } from "../../../src/react/event-form/event-form";
import type { StopwatchSnapshot } from "../../../src/react/views/stopwatch";
import type { SingleCalendarConfig } from "../../../src/types/settings";
import { createMockSingleCalendarSettings } from "../../fixtures/settings-fixtures";

function defaultUnmountState(values: EventFormValues): MinimizedModalState {
	return {
		formState: values.formState,
		stopwatch: values.stopwatchSnapshot ?? {
			state: "idle",
			startTime: null,
			breakStartTime: null,
			sessionStartTime: null,
			totalBreakMs: 0,
		},
		modalType: "create",
		filePath: null,
		originalFrontmatter: {},
		calendarId: "test",
	};
}

interface CapturedSuggestOptions {
	onAcceptTitle?: (title: string) => void;
}

const lastSuggestOptions: { current: CapturedSuggestOptions | null } = { current: null };

const { openCategoryAssignModalSpy, openPrerequisiteAssignModalSpy } = vi.hoisted(() => ({
	openCategoryAssignModalSpy: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
	openPrerequisiteAssignModalSpy: vi.fn((..._args: unknown[]) => Promise.resolve(undefined)),
}));
vi.mock("../../../src/react/modals", () => ({
	openCategoryAssignModal: openCategoryAssignModalSpy,
	openPrerequisiteAssignModal: openPrerequisiteAssignModalSpy,
	openSavePresetModal: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../../src/components/title-input-suggest", () => {
	const ctor = vi.fn();
	class TitleInputSuggest {
		destroy = vi.fn();
		close = vi.fn();
		constructor(_app: unknown, _input: unknown, _bundle: unknown, options?: CapturedSuggestOptions) {
			ctor(_app, _input, _bundle, options);
			lastSuggestOptions.current = options ?? null;
		}
	}
	return { TitleInputSuggest, __ctorSpy: ctor };
});

const titleSuggestCtor = (
	(await import("../../../src/components/title-input-suggest")) as unknown as { __ctorSpy: ReturnType<typeof vi.fn> }
).__ctorSpy;

function buildSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createMockSingleCalendarSettings(),
		categoryProp: "Category",
		locationProp: "Location",
		iconProp: "Icon",
		breakProp: "Break",
		statusProperty: "Status",
		skipProp: "Skip",
		participantsProp: "Participants",
		prerequisiteProp: "Prerequisites",
		enableNotifications: true,
		showStopwatch: true,
		showDurationField: true,
		eventPresets: [],
		defaultPresetId: "",
		titleAutocomplete: true,
		autoAssignCategoryByName: false,
		categoryAssignmentPresets: [],
		defaultNodeColor: "#7e7e7e",
		frontmatterDisplayProperties: [],
		frontmatterDisplayPropertiesAllDay: [],
		...overrides,
	} as SingleCalendarConfig;
}

function createMockBundle(overrides: Partial<SingleCalendarConfig> = {}): CalendarBundle {
	const settings = buildSettings(overrides);
	const subject = new BehaviorSubject(settings);
	return {
		calendarId: "test",
		settingsStore: {
			settings$: subject,
			get currentSettings() {
				return settings;
			},
			updateSettings: vi.fn(),
		},
		categoryTracker: {
			getCategories: () => [],
			getCategoriesWithColors: () => [],
		},
		eventStore: {
			findNextEventByStartTime: () => null,
			findPreviousEventByEndTime: () => null,
		},
		fileRepository: {
			events$: { subscribe: () => ({ unsubscribe: () => undefined }) },
		},
		plugin: {
			app: {} as never,
			isProEnabled: false,
			syncStore: { data: { readOnly: false } },
			calendarBundles: [],
		},
	} as unknown as CalendarBundle;
}

beforeEach(() => {
	titleSuggestCtor.mockClear();
	lastSuggestOptions.current = null;
	openCategoryAssignModalSpy.mockClear();
	openPrerequisiteAssignModalSpy.mockClear();
	(Notice as unknown as ReturnType<typeof vi.fn>).mockClear?.();
	MinimizedModalManager.clear();
});

afterEach(() => {
	MinimizedModalManager.clear();
});

// ─── #4: titleAutocomplete setting must gate TitleInputSuggest ────────────

describe("event-form regression #4 — titleAutocomplete gate", () => {
	it("constructs TitleInputSuggest when titleAutocomplete is true", () => {
		const bundle = createMockBundle({ titleAutocomplete: true });
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);
		expect(titleSuggestCtor).toHaveBeenCalledTimes(1);
	});

	it("does NOT construct TitleInputSuggest when titleAutocomplete is false", () => {
		const bundle = createMockBundle({ titleAutocomplete: false });
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);
		expect(titleSuggestCtor).not.toHaveBeenCalled();
	});

	// Regression: accepting a ghost suggestion via Enter used to call
	// `inputEl.blur()`, which moved focus to <body> and silently disabled
	// the user's "Enter to accept, Enter to submit" double-tap flow. The
	// TitleField's onAcceptTitle wrapper now writes the chosen value into
	// the form (so the suggestion text is persisted) AND keeps focus on
	// the title input (so the next Enter still reaches the form's submit
	// hotkey). This test drives the accept path through the captured
	// callback rather than the real Obsidian popup (which can't run in jsdom).
	it("accepting a suggestion writes the title into the form and keeps focus on the input (double-Enter survives)", async () => {
		const bundle = createMockBundle();
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={bundle}
				initialState={{ ...createDefaultState(), start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.click(titleInput);
		await user.type(titleInput, "Planni");

		// Sanity: the wired callback exists.
		const acceptTitle = lastSuggestOptions.current?.onAcceptTitle;
		expect(acceptTitle).toBeDefined();

		// Simulate Obsidian's popup firing onSelect → onAcceptTitle("Planning").
		// The wrapper writes the title into the form and runs onBlur (auto-
		// category assignment). Wrap in act so React processes the state
		// update synchronously.
		await act(async () => {
			acceptTitle!("Planning");
		});

		// The form (and DOM) reflect the chosen suggestion, not the typed prefix.
		expect(titleInput.value).toBe("Planning");
		// Focus stays on the title input — this is what enables the second Enter.
		// (The suggester also schedules a queueMicrotask refocus in production
		// to defensively reclaim focus if Obsidian shifted it; here we only
		// drive the React owner's callback, so focus is preserved naturally.)
		expect(document.activeElement).toBe(titleInput);

		// Press Enter on the focused title input → form-level useEnterToSubmit
		// fires (because focus is inside the form root). A regression that
		// blurs the input here would route Enter to <body> and onSubmit would
		// never fire.
		await user.keyboard("{Enter}");

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1);
		});
		expect(onSubmit.mock.calls[0][0].formState.title).toBe("Planning");
	});
});

// ─── #5: stopwatch break accumulates from initial value ───────────────────
// ─── #6: stopwatch continue resets baseline + bumps past end time ─────────
// ─── #8: Clear button resets the stopwatch ───────────────────────────────

describe("event-form regression #5 #6 #8 — stopwatch parity", () => {
	function renderWithStopwatch(
		initial: Partial<EventFormState> = {},
		settingsOverrides: Partial<SingleCalendarConfig> = {}
	) {
		const bundle = createMockBundle({ showStopwatch: true, breakProp: "Break", ...settingsOverrides });
		const result = render(
			<EventForm
				mode="create"
				bundle={bundle}
				initialState={{ ...createDefaultState(), ...initial }}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);
		return { ...result, bundle };
	}

	it("#5 onBreakUpdate accumulates initial break minutes plus session minutes", async () => {
		// Pre-fill break field with 15. Start stopwatch. Emit a break update of 5.
		// The break field must read "20" (15 + 5), NOT "5" (overwriting the initial).
		renderWithStopwatch({ breakMinutes: "15" });

		const breakInput = screen.getByTestId("prisma-event-control-breakMinutes") as HTMLInputElement;
		expect(breakInput.value).toBe("15");

		// Click stopwatch Start button. It's the first .prisma-stopwatch-start-btn.
		const startBtn = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
		expect(startBtn).not.toBeNull();
		await act(async () => {
			startBtn.click();
		});

		// Trigger a pause+resume cycle to generate a non-zero break.
		// Simpler: directly call the imperative ref's onBreakUpdate by simulating a pause for 60s.
		// For unit-test pragmatism, we instead pause, advance time, resume.
		const pauseBtn = document.querySelector(".prisma-stopwatch-pause-btn") as HTMLButtonElement;
		expect(pauseBtn).not.toBeNull();
		vi.useFakeTimers();
		try {
			await act(async () => {
				pauseBtn.click();
			});
			await act(async () => {
				vi.advanceTimersByTime(60_000);
			});
			const resumeBtn = document.querySelector(".prisma-stopwatch-resume-btn") as HTMLButtonElement;
			await act(async () => {
				resumeBtn.click();
			});
		} finally {
			vi.useRealTimers();
		}

		// The break field should now read approximately 16 (15 initial + ~1 min session).
		const breakValue = Number.parseFloat(breakInput.value);
		expect(breakValue).toBeGreaterThanOrEqual(15.5);
		expect(breakValue).toBeLessThanOrEqual(17);
	});

	it("#8 Clear button resets the running stopwatch", async () => {
		const user = userEvent.setup();
		renderWithStopwatch();

		const startBtn = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
		await act(async () => {
			startBtn.click();
		});

		// Stopwatch should now be running. Confirm via state-dependent class on the button.
		const stopBtn = document.querySelector(".prisma-stopwatch-stop-btn") as HTMLButtonElement | null;
		expect(stopBtn).not.toBeNull();
		expect(stopBtn!.classList.contains("prisma-hidden")).toBe(false);

		// Click Clear.
		await user.click(screen.getByTestId("prisma-event-btn-clear"));

		// After clear, the stopwatch should be reset back to idle: start button visible, stop button hidden.
		await waitFor(() => {
			const startAfter = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
			expect(startAfter.classList.contains("prisma-hidden")).toBe(false);
			const stopAfter = document.querySelector(".prisma-stopwatch-stop-btn") as HTMLButtonElement;
			expect(stopAfter.classList.contains("prisma-hidden")).toBe(true);
		});
	});

	it("#6 stopwatch continue bumps end-time-in-past to now", async () => {
		// Continue-from-existing fires when the stopwatch is idle but the form
		// already has a start time. Mirrors editing an event with a stale end.
		const past = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
		const pastEnd = formatLocalDateTime(past);
		renderWithStopwatch({
			start: "2020-01-01T09:00",
			end: pastEnd,
		});

		const endInput = screen.getByTestId("prisma-event-control-end") as HTMLInputElement;
		expect(endInput.value).toBe(pastEnd);

		// The .continue-btn is rendered while idle, NOT hidden via `prisma-hidden`.
		const continueBtn = document.querySelector(".prisma-stopwatch-continue-btn") as HTMLButtonElement;
		expect(continueBtn).not.toBeNull();
		expect(continueBtn.classList.contains("prisma-hidden")).toBe(false);

		await act(async () => {
			continueBtn.click();
		});

		await waitFor(() => {
			// End must have been moved forward past the in-past stamp.
			expect(endInput.value).not.toBe(pastEnd);
			const parsed = new Date(endInput.value).getTime();
			expect(parsed).toBeGreaterThan(past.getTime());
		});
	});
});

function formatLocalDateTime(d: Date): string {
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── #7: Submit hotkey (Enter in form → save) ────────────────────────────

describe("event-form regression #7 — submit hotkey", () => {
	it("fires onSubmit when Enter is pressed inside the title input", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		const title = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.click(title);
		await user.type(title, "My Event{Enter}");

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1);
		});
	});

	it("does NOT fire onSubmit when Enter is pressed inside the participant input", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(<EventForm mode="create" bundle={createMockBundle()} onSubmit={onSubmit} onCancel={vi.fn()} />);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(titleInput, "Some Title"); // satisfy validation if Enter ever escapes
		const participant = screen.getByTestId("prisma-event-control-participants") as HTMLInputElement;
		await user.click(participant);
		await user.type(participant, "Alice{Enter}");

		expect(onSubmit).not.toHaveBeenCalled();
	});
});

// ─── Assign shortcuts (Mod+Shift+C, Mod+Shift+P) ──────────────────────────

describe("event-form — Assign keyboard shortcuts", () => {
	function renderForm(onSubmit = vi.fn()) {
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Workout", start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);
		return { onSubmit };
	}

	it("opens Assign Categories on Ctrl+Shift+C", async () => {
		const user = userEvent.setup();
		renderForm();
		await user.keyboard("{Control>}{Shift>}c{/Shift}{/Control}");
		expect(openCategoryAssignModalSpy).toHaveBeenCalledTimes(1);
	});

	it("opens Assign Categories on Meta+Shift+C (Mac)", async () => {
		const user = userEvent.setup();
		renderForm();
		await user.keyboard("{Meta>}{Shift>}c{/Shift}{/Meta}");
		expect(openCategoryAssignModalSpy).toHaveBeenCalledTimes(1);
	});

	it("opens Assign Prerequisites on Ctrl+Shift+P", async () => {
		const user = userEvent.setup();
		renderForm();
		await user.keyboard("{Control>}{Shift>}p{/Shift}{/Control}");
		expect(openPrerequisiteAssignModalSpy).toHaveBeenCalledTimes(1);
	});

	it("does NOT submit the form when a shortcut fires", async () => {
		const user = userEvent.setup();
		const { onSubmit } = renderForm();
		await user.keyboard("{Control>}{Shift>}c{/Shift}{/Control}");
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("does NOT fire on plain Ctrl+C (Shift is required, prevents clobbering copy)", async () => {
		const user = userEvent.setup();
		renderForm();
		await user.keyboard("{Control>}c{/Control}");
		expect(openCategoryAssignModalSpy).not.toHaveBeenCalled();
	});

	it("unregisters the shortcut when the form unmounts (no stray document listeners)", async () => {
		const user = userEvent.setup();
		const { unmount } = render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Workout", start: "2026-05-17T09:00" }}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);
		unmount();
		await user.keyboard("{Control>}{Shift>}c{/Shift}{/Control}");
		expect(openCategoryAssignModalSpy).not.toHaveBeenCalled();
	});
});

// ─── #9: Title focus restored after validation failure ───────────────────

describe("event-form regression #9 — title focus on validation failure", () => {
	it("returns focus to the title input after illegal-character validation fails", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(<EventForm mode="create" bundle={createMockBundle()} onSubmit={onSubmit} onCancel={vi.fn()} />);

		const title = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(title, "Bad/Slash");
		// Move focus elsewhere to make the assertion meaningful.
		await user.click(screen.getByTestId("prisma-event-btn-clear"));
		// Refill, then click Save.
		await user.type(title, "Bad/Slash");
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(title);
	});
});

// ─── #3: Close-while-stopwatch-active auto-saves to MinimizedModalManager ─

describe("event-form regression #3 — close with active stopwatch auto-saves state", () => {
	it("saves state to MinimizedModalManager on unmount when stopwatch is active", async () => {
		const bundle = createMockBundle();
		const saveSpy = vi.spyOn(MinimizedModalManager, "saveState");

		const { unmount } = render(
			<EventForm
				mode="create"
				bundle={bundle}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				onUnmountWithActiveStopwatch={defaultUnmountState}
			/>
		);

		// Start the stopwatch.
		const startBtn = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
		await act(async () => {
			startBtn.click();
		});
		// Wait for the snapshot ref update that we schedule via queueMicrotask.
		await new Promise((r) => window.setTimeout(r, 0));

		await act(async () => {
			unmount();
		});

		expect(saveSpy).toHaveBeenCalledTimes(1);
		const [savedState] = saveSpy.mock.calls[0]!;
		expect(savedState.stopwatch.state).toBe("running");
	});

	it("does NOT save state on unmount when stopwatch is idle", async () => {
		const bundle = createMockBundle();
		const saveSpy = vi.spyOn(MinimizedModalManager, "saveState");

		const { unmount } = render(
			<EventForm
				mode="create"
				bundle={bundle}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				onUnmountWithActiveStopwatch={defaultUnmountState}
			/>
		);

		unmount();

		expect(saveSpy).not.toHaveBeenCalled();
	});

	it("does NOT double-save state when user explicitly clicks Minimize", async () => {
		const bundle = createMockBundle();
		const saveSpy = vi.spyOn(MinimizedModalManager, "saveState");
		const onMinimize = vi.fn(() => {
			// Caller would normally route through saveMinimizedModalState which calls saveState.
			MinimizedModalManager.saveState(
				{
					formState: createDefaultState(),
					stopwatch: {
						state: "running",
						startTime: Date.now(),
						breakStartTime: null,
						sessionStartTime: Date.now(),
						totalBreakMs: 0,
					} as StopwatchSnapshot,
					modalType: "create",
					filePath: null,
					originalFrontmatter: {},
					calendarId: "test",
				},
				bundle
			);
		});

		const { unmount } = render(
			<EventForm
				mode="create"
				bundle={bundle}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				onMinimize={onMinimize}
				onUnmountWithActiveStopwatch={defaultUnmountState}
			/>
		);

		const startBtn = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
		await act(async () => {
			startBtn.click();
		});

		const user = userEvent.setup();
		await user.click(screen.getByTestId("prisma-event-btn-minimize"));
		unmount();

		// One save from the minimize button, zero additional from unmount.
		expect(saveSpy).toHaveBeenCalledTimes(1);
	});

	it("the auto-saved stopwatch is in running state (not 'idle')", async () => {
		// User report: starting the stopwatch then closing the modal does not
		// preserve a runnable snapshot — restoreModal sees a state where the
		// stopwatch isn't active so internal tracking never restarts.
		const bundle = createMockBundle();
		const saveSpy = vi.spyOn(MinimizedModalManager, "saveState");

		const { unmount } = render(
			<EventForm
				mode="create"
				bundle={bundle}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				onUnmountWithActiveStopwatch={defaultUnmountState}
			/>
		);

		const startBtn = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
		await act(async () => {
			startBtn.click();
		});
		await new Promise((r) => window.setTimeout(r, 0));

		await act(async () => {
			unmount();
		});

		expect(saveSpy).toHaveBeenCalledTimes(1);
		const [savedState] = saveSpy.mock.calls[0]!;
		// Must be a runnable state — "idle" / "stopped" would prevent the manager
		// from spinning up internal tracking and would render restore inert.
		expect(savedState.stopwatch.state).toBe("running");
		expect(savedState.stopwatch.startTime).not.toBeNull();
	});

	it("Save with a running stopwatch keeps the minimized state alive (imperative parity)", async () => {
		// Mirrors base-event-modal.ts onClose(): when a stopwatch is active,
		// closing the modal — by ANY route, including the Save button — auto-saves
		// to MinimizedModalManager so the user can restore and continue tracking.
		// Pressing Minimize is the only opt-out (avoids double-save).
		const bundle = createMockBundle();
		const saveSpy = vi.spyOn(MinimizedModalManager, "saveState");
		const onSubmit = vi.fn();
		const user = userEvent.setup();

		const { unmount } = render(
			<EventForm
				mode="create"
				bundle={bundle}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
				onUnmountWithActiveStopwatch={defaultUnmountState}
			/>
		);

		const startBtn = document.querySelector(".prisma-stopwatch-start-btn") as HTMLButtonElement;
		await act(async () => {
			startBtn.click();
		});
		await new Promise((r) => window.setTimeout(r, 0));

		const title = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(title, "Done");
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).toHaveBeenCalledTimes(1);
		saveSpy.mockClear();

		await act(async () => {
			unmount();
		});

		// One auto-save fires on unmount so the running stopwatch survives.
		expect(saveSpy).toHaveBeenCalledTimes(1);
		const [savedState] = saveSpy.mock.calls[0]!;
		expect(savedState.stopwatch.state).toBe("running");
	});
});

// ─── Bug A: Restoring a running stopwatch boots the form in 'running' ──
//
// User report: after starting the stopwatch and dismissing the modal, hitting
// "Restore minimized event modal" did not resume tracking. This pins the
// boot-up contract: an EventForm given a running snapshot shows the stopwatch
// as running (stop button visible, start button hidden).

describe("event-form bug — restore boots stopwatch into running state", () => {
	function findVisibleButton(selector: string): HTMLButtonElement | null {
		const btn = document.querySelector(selector) as HTMLButtonElement | null;
		if (!btn) return null;
		return btn.classList.contains("prisma-hidden") ? null : btn;
	}

	it("renders the stop button visible when seeded with a running snapshot", () => {
		const now = Date.now() - 30_000;
		render(
			<EventForm
				mode="edit"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Existing", start: "2026-05-17T09:00" }}
				initialStopwatchSnapshot={{
					state: "running",
					startTime: now,
					sessionStartTime: now,
					breakStartTime: null,
					totalBreakMs: 0,
				}}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);

		// Start button should be hidden, stop button visible.
		expect(findVisibleButton(".prisma-stopwatch-start-btn")).toBeNull();
		expect(findVisibleButton(".prisma-stopwatch-stop-btn")).not.toBeNull();
	});

	it("renders the pause button visible when seeded with a paused snapshot", async () => {
		const now = Date.now() - 30_000;
		render(
			<EventForm
				mode="edit"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Existing", start: "2026-05-17T09:00" }}
				initialStopwatchSnapshot={{
					state: "paused",
					startTime: now,
					sessionStartTime: now,
					breakStartTime: Date.now(),
					totalBreakMs: 0,
				}}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);

		// importState dispatches a forceTick; let it flush before assertions.
		await waitFor(() => {
			expect(findVisibleButton(".prisma-stopwatch-start-btn")).toBeNull();
		});
		// Paused state swaps the pause button's class to "resume" + "▶ continue".
		expect(findVisibleButton(".prisma-stopwatch-resume-btn")).not.toBeNull();
	});
});

// ─── Bug B': Submit must be blocked when title is empty ─────────────────
//
// User clarification (after the date-anchor fix): the title field must
// contain at least one non-whitespace character — empty or whitespace-only
// titles silently produced files with no usable name.

describe("event-form bug — submit without a title is blocked", () => {
	it("does NOT call onSubmit when the title is empty", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("does NOT call onSubmit when the title is whitespace-only", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		const title = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(title, "   ");
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("DOES call onSubmit when the title has a single letter", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		const title = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(title, "A");
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("focuses the title input when blocking an empty submit", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		const save = screen.getByTestId("prisma-event-btn-save");
		save.focus();
		await user.click(save);

		const title = screen.getByTestId("prisma-event-control-title");
		expect(document.activeElement).toBe(title);
	});
});

// ─── Bug B: Submit must be blocked when there is no date anchor ─────────
//
// User report: pressing Create → Clear → Save produced an empty "untracked"
// event because buildEventSaveData falls back to isUntracked=true whenever
// start/date is missing. Block the save so the user has to pick a time.

describe("event-form bug — submit without a date anchor is blocked", () => {
	it("does NOT call onSubmit for a timed event with no start", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Work" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalled();
	});

	it("DOES call onSubmit when the timed event has a start time", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Work", start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("does NOT call onSubmit for an all-day event with no date", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Holiday", allDay: true }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("DOES call onSubmit when the all-day event has a date", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Holiday", allDay: true, date: "2026-05-17" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("Clear + Save (the user's reported flow) is rejected", async () => {
		const onSubmit = vi.fn();
		const user = userEvent.setup();
		render(
			<EventForm
				mode="create"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Pre-filled", start: "2026-05-17T09:00" }}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-btn-clear"));
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
	});
});

// ─── Bug C: Title input is focused on initial mount ──────────────────────
//
// Imperative base-event-modal.ts onOpen(): `void afterRender().then(() => {
// this.titleInput.focus(); });` — opening the modal puts the cursor in the
// title field. The React port skipped this; user has to click before typing.

describe("event-form bug — title autofocus on open", () => {
	it("focuses the title input when the form mounts", async () => {
		render(<EventForm mode="create" bundle={createMockBundle()} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const title = screen.getByTestId("prisma-event-control-title");
		await waitFor(() => {
			expect(document.activeElement).toBe(title);
		});
	});

	it("focuses the title input when the form mounts in edit mode", async () => {
		render(
			<EventForm
				mode="edit"
				bundle={createMockBundle()}
				initialState={{ ...createDefaultState(), title: "Existing" }}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);

		const title = screen.getByTestId("prisma-event-control-title");
		await waitFor(() => {
			expect(document.activeElement).toBe(title);
		});
	});
});
