import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createDefaultState,
	EventFormStateSchema,
	type EventFormState,
} from "../../../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../../../src/core/calendar-bundle";
import { END_TIME_SYNC_INTERVAL_MS } from "../../../../src/core/minimized-modal-manager";
import { EventForm } from "../../../../src/react/event-form/event-form";
import { useStopwatch } from "../../../../src/react/event-form/hooks/use-stopwatch";
import { TimingSection } from "../../../../src/react/event-form/sections/timing-section";
import { Stopwatch, type StopwatchHandle } from "../../../../src/react/views/stopwatch";
import type { SingleCalendarConfig } from "../../../../src/types/settings";
import { createMockSingleCalendarSettings } from "../../../fixtures/settings-fixtures";

function actReturn<T>(fn: () => T): T {
	let value!: T;
	act(() => {
		value = fn();
	});
	return value;
}

interface HookHarness {
	form: UseFormReturn<EventFormState>;
	stopwatch: ReturnType<typeof useStopwatch>;
}

function mountHook(defaults: Partial<EventFormState>) {
	const setMetadataValues = vi.fn();
	const { result } = renderHook<HookHarness, void>(() => {
		const form = useForm<EventFormState>({
			defaultValues: { ...createDefaultState(), ...defaults } as EventFormState,
		});
		const stopwatch = useStopwatch({
			form,
			initialSnapshot: null,
			autoStart: false,
			setMetadataValues,
		});
		return { form, stopwatch };
	});
	return result;
}

describe("useStopwatch.onContinueRequested", () => {
	it("returns null when the form has no start value", () => {
		const result = mountHook({ start: "" });
		const date = result.current.stopwatch.onContinueRequested();
		expect(date).toBeNull();
	});

	it("returns the initial start value when nothing has changed", () => {
		const result = mountHook({ start: "2026-05-19T10:00" });
		const date = result.current.stopwatch.onContinueRequested();
		expect(date).not.toBeNull();
		expect(date?.getHours()).toBe(10);
		expect(date?.getMinutes()).toBe(0);
	});

	// Regression: editing the Start Date input in the edit modal and THEN
	// clicking Continue on the stopwatch must use the new value, not the
	// snapshot taken when the modal opened.
	it("returns the latest form start value after the user edits it", () => {
		const result = mountHook({ start: "2026-05-19T10:00" });

		act(() => {
			result.current.form.setValue("start", "2026-05-19T11:00");
		});

		const date = result.current.stopwatch.onContinueRequested();
		expect(date).not.toBeNull();
		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(4); // 0-indexed; May
		expect(date?.getDate()).toBe(19);
		expect(date?.getHours()).toBe(11);
		expect(date?.getMinutes()).toBe(0);
	});

	it("pushes the end forward to 'now' when the stored end is in the past", () => {
		// Pick a past end so onContinueRequested's "resume after a gap" branch
		// fires: see use-stopwatch.ts onContinueRequested().
		const pastEnd = "2025-01-01T08:00";
		const result = mountHook({ start: "2026-05-19T10:00", end: pastEnd });

		act(() => {
			result.current.stopwatch.onContinueRequested();
		});

		const newEnd = result.current.form.getValues("end");
		expect(newEnd).not.toBe(pastEnd);
		expect(EventFormStateSchema.shape.end.parse(newEnd)).toBe(newEnd);
	});

	// Regression: typing into the Start Date input then clicking Continue used to
	// return the original start because TimingSection wraps the start field in
	// its own `useController`. The form-level store sees the new value, but the
	// hook used to read a snapshot captured during the modal-open render.
	//
	// Drives the same path the user clicks through: real <input> change events
	// → useController.onChange → form state → hook reads back.
	it("returns the latest value after the user edits the Start Date input", () => {
		const initial = "2026-05-19T10:00";
		const typed = "2026-05-19T11:00";

		function Harness({ stopwatchRef }: { stopwatchRef: { current: ReturnType<typeof useStopwatch> | null } }) {
			const form = useForm<EventFormState>({
				defaultValues: { ...createDefaultState(), start: initial, end: "2026-05-19T12:00" } as EventFormState,
			});
			const [metadata, setMetadata] = useState<Record<string, unknown>>({});
			void metadata;
			const stopwatch = useStopwatch({
				form,
				initialSnapshot: null,
				autoStart: false,
				setMetadataValues: setMetadata,
			});
			stopwatchRef.current = stopwatch;
			return <TimingSection form={form} showDurationField={false} />;
		}

		const stopwatchRef: { current: ReturnType<typeof useStopwatch> | null } = { current: null };
		render(<Harness stopwatchRef={stopwatchRef} />);

		const startInput = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		expect(startInput.value).toBe(initial);

		act(() => {
			fireEvent.change(startInput, { target: { value: typed } });
		});

		expect(startInput.value).toBe(typed);

		// `start` is in the past, so onContinueRequested pushes `end` forward via
		// form.setValue — wrap in act so the resulting re-render is flushed.
		const date = actReturn(() => stopwatchRef.current?.onContinueRequested() ?? null);
		expect(date).not.toBeNull();
		expect(date?.getHours()).toBe(11);
		expect(date?.getMinutes()).toBe(0);
	});

	// Higher-fidelity regression: in the real modal the start input lives in
	// `TimingSection` while the stopwatch button lives in `Stopwatch`. Both
	// branches are siblings under EventForm. This test stamps the input on the
	// React tree, registers a stable continue button, and verifies the latest
	// edited value flows through. The previous bug — useController wrapping
	// the field with its own state — would break THIS too.
	it("continue button reads the latest start across sibling components", () => {
		const initial = "2026-05-19T09:00";
		const edited = "2026-05-19T10:30";

		function ContinueBtn({ onContinueRequested }: { onContinueRequested: () => Date | null }) {
			const [resolved, setResolved] = useState<Date | null>(null);
			return (
				<>
					<button data-testid="hook-continue" type="button" onClick={() => setResolved(onContinueRequested())}>
						continue
					</button>
					<span data-testid="hook-resolved-iso">{resolved ? resolved.toISOString() : ""}</span>
				</>
			);
		}

		function Harness() {
			const form = useForm<EventFormState>({
				defaultValues: { ...createDefaultState(), start: initial, end: "2026-05-19T12:00" } as EventFormState,
			});
			const [metadata, setMetadata] = useState<Record<string, unknown>>({});
			void metadata;
			const stopwatch = useStopwatch({
				form,
				initialSnapshot: null,
				autoStart: false,
				setMetadataValues: setMetadata,
			});
			return (
				<>
					<TimingSection form={form} showDurationField={false} />
					<ContinueBtn onContinueRequested={stopwatch.onContinueRequested} />
				</>
			);
		}

		render(<Harness />);

		const startInput = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		act(() => {
			fireEvent.change(startInput, { target: { value: edited } });
		});
		expect(startInput.value).toBe(edited);

		act(() => {
			fireEvent.click(screen.getByTestId("hook-continue"));
		});

		const iso = screen.getByTestId("hook-resolved-iso").textContent ?? "";
		expect(iso).not.toBe("");
		const resolved = new Date(iso);
		expect(resolved.getHours()).toBe(10);
		expect(resolved.getMinutes()).toBe(30);
	});

	// The bug-end-to-end: edit Start Date, then click the actual <Stopwatch>
	// "▶ continue" button. The stopwatch's internal startTime (exportState)
	// must match the typed value, NOT the value at mount.
	it("Stopwatch.continueFromExisting picks up the latest typed start value", () => {
		const initialIso = "2026-05-19T08:00";
		// Choose an edited value that is BEFORE Date.now() so continueFromExisting
		// is allowed (it refuses future starts). Date.now() floats with the test
		// clock — compute a deterministic "1 hour ago" instead.
		const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
		const oneHourAgo = new Date(oneHourAgoMs);
		const editedIso = formatLocal(oneHourAgo);

		function Harness({ handleRef }: { handleRef: { current: StopwatchHandle | null } }) {
			const form = useForm<EventFormState>({
				defaultValues: { ...createDefaultState(), start: initialIso, end: "2026-05-19T12:00" } as EventFormState,
			});
			const [metadata, setMetadata] = useState<Record<string, unknown>>({});
			void metadata;
			const localHandleRef = useRef<StopwatchHandle | null>(null);
			const stopwatch = useStopwatch({
				form,
				initialSnapshot: null,
				autoStart: false,
				setMetadataValues: setMetadata,
			});
			// Bridge the internal handle out to the test through both refs so the
			// assertion can read exportState() without exposing the imperative
			// handle on the public surface.
			const setHandle = (h: StopwatchHandle | null) => {
				localHandleRef.current = h;
				handleRef.current = h;
				stopwatch.setHandle(h);
			};
			return (
				<>
					<TimingSection form={form} showDurationField={false} />
					<Stopwatch
						ref={setHandle}
						onStart={stopwatch.onStart}
						onContinueRequested={stopwatch.onContinueRequested}
						onResumeRequested={stopwatch.onResumeRequested}
						onStop={stopwatch.onStop}
						onBreakUpdate={stopwatch.onBreakUpdate}
					/>
				</>
			);
		}

		const handleRef: { current: StopwatchHandle | null } = { current: null };
		render(<Harness handleRef={handleRef} />);

		const startInput = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		act(() => {
			fireEvent.change(startInput, { target: { value: editedIso } });
		});
		expect(startInput.value).toBe(editedIso);

		const continueBtn = screen.getByTestId("prisma-stopwatch-btn-continue");
		act(() => {
			fireEvent.click(continueBtn);
		});

		const state = handleRef.current!.exportState();
		expect(state.state).toBe("running");
		expect(state.startTime).not.toBeNull();
		// The continue button must have grabbed the edited value, not the
		// initial "2026-05-19T08:00" snapshot captured at mount.
		const expectedMs = oneHourAgo.getTime();
		// Allow a tiny drift for clock granularity (parse → format → parse loses
		// seconds), but reject the order-of-magnitude error the bug would produce.
		expect(Math.abs((state.startTime ?? 0) - expectedMs)).toBeLessThan(60_000);
	});
});

// Full EventForm regression: render the exact component the modal renders, with
// stopwatch enabled, type into Start Date, click the (collapsed-then-expanded)
// stopwatch Continue, then read back through onSubmit. The "current" RHF form
// state must contain the edited start, AND the actual elapsed ms displayed by
// the stopwatch must be derived from the edited start.
function createMockBundleWithStopwatch(): CalendarBundle {
	const settings = {
		...createMockSingleCalendarSettings(),
		categoryProp: "Category",
		locationProp: "Location",
		iconProp: "Icon",
		breakProp: "Break",
		statusProperty: "Status",
		skipProp: "Skip",
		participantsProp: "Participants",
		prerequisiteProp: "Prerequisites",
		enableNotifications: false,
		showStopwatch: true,
		showDurationField: false,
		eventPresets: [],
		defaultPresetId: "",
		titleAutocomplete: false,
		autoAssignCategoryByName: false,
		categoryAssignmentPresets: [],
		defaultNodeColor: "#7e7e7e",
		frontmatterDisplayProperties: [],
		frontmatterDisplayPropertiesAllDay: [],
	} as SingleCalendarConfig;
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
		plugin: {
			app: {} as never,
			isProEnabled: false,
			syncStore: { data: { readOnly: false } },
			calendarBundles: [],
		},
	} as unknown as CalendarBundle;
}

describe("useStopwatch.onResumeRequested", () => {
	it("returns the latest start without re-capturing the break baseline", () => {
		const result = mountHook({ start: "2026-05-19T10:00", end: "2026-05-19T11:00" });

		act(() => {
			result.current.form.setValue("start", "2026-05-19T11:30");
		});

		// The stored end is in the past, so onResumeRequested pushes it forward
		// via form.setValue — wrap in act so the resulting re-render is flushed.
		const date = actReturn(() => result.current.stopwatch.onResumeRequested());
		expect(date).not.toBeNull();
		expect(date?.getHours()).toBe(11);
		expect(date?.getMinutes()).toBe(30);
	});

	it("returns null when start is empty", () => {
		const result = mountHook({ start: "" });
		expect(result.current.stopwatch.onResumeRequested()).toBeNull();
	});

	it("pushes end forward to 'now' when the stored end is in the past", () => {
		const pastEnd = "2025-01-01T08:00";
		const result = mountHook({ start: "2026-05-19T10:00", end: pastEnd });

		act(() => {
			result.current.stopwatch.onResumeRequested();
		});

		expect(result.current.form.getValues("end")).not.toBe(pastEnd);
	});
});

// Regression: a running stopwatch left End frozen at the start+5min stamp until
// Stop. It now snaps End to "now" every interval while running, holds while
// paused/idle.
describe("useStopwatch — periodic End sync while running", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	function makeHandle(state: "running" | "paused" | "idle" | "stopped"): StopwatchHandle {
		return { getState: () => state } as StopwatchHandle;
	}

	it("advances End to now every END_TIME_SYNC_INTERVAL_MS while running", () => {
		vi.setSystemTime(new Date("2026-05-20T10:00:00"));
		const result = mountHook({ start: "2026-05-20T10:00", end: "2026-05-20T11:00" });

		act(() => result.current.stopwatch.setHandle(makeHandle("running")));
		act(() => {
			vi.advanceTimersByTime(END_TIME_SYNC_INTERVAL_MS * 2);
		});

		// now = base + 10min → End snaps to 10:10:00, overwriting the seeded 11:00.
		expect(result.current.form.getValues("end")).toBe("2026-05-20T10:10:00");
	});

	it("leaves End untouched while paused (break time is not billable)", () => {
		vi.setSystemTime(new Date("2026-05-20T10:00:00"));
		const result = mountHook({ start: "2026-05-20T10:00", end: "2026-05-20T11:00" });

		act(() => result.current.stopwatch.setHandle(makeHandle("paused")));
		act(() => {
			vi.advanceTimersByTime(END_TIME_SYNC_INTERVAL_MS * 2);
		});

		expect(result.current.form.getValues("end")).toBe("2026-05-20T11:00");
	});

	it("leaves End untouched when the stopwatch is idle (no active session)", () => {
		vi.setSystemTime(new Date("2026-05-20T10:00:00"));
		const result = mountHook({ start: "2026-05-20T10:00", end: "2026-05-20T11:00" });

		// No handle wired → getState() never reports "running".
		act(() => {
			vi.advanceTimersByTime(END_TIME_SYNC_INTERVAL_MS * 2);
		});

		expect(result.current.form.getValues("end")).toBe("2026-05-20T11:00");
	});
});

describe("EventForm + Stopwatch regression", () => {
	// This is the test that captures the user's reported bug end-to-end. If RHF
	// or the input wiring stops propagating edits to form.getValues, this
	// assertion catches it at the point a real user would notice.
	it("Continue button in edit modal uses the latest Start Date after the user edits it", () => {
		const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
		const editedIso = formatLocal(new Date(oneHourAgoMs));
		const initialIso = "2026-05-19T08:00";

		const bundle = createMockBundleWithStopwatch();
		render(
			<EventForm
				mode="edit"
				bundle={bundle}
				initialState={{ ...createDefaultState(), start: initialIso, end: "2026-05-19T12:00", title: "Sample" }}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);

		const startInput = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		expect(startInput.value).toBe(initialIso);

		act(() => {
			fireEvent.change(startInput, { target: { value: editedIso } });
		});
		expect(startInput.value).toBe(editedIso);

		// The stopwatch's Continue button is conditionally rendered in idle, but
		// it's stamped with a stable testid we can target directly.
		const continueBtn = screen.getByTestId("prisma-stopwatch-btn-continue");
		act(() => {
			fireEvent.click(continueBtn);
		});

		// The stopwatch display now reflects elapsed ≈ now - editedStart.
		// At one hour ago, the readout is ~1:00:00; the bug would show 0:00:00
		// (refused future) or whatever the initial 2026-05-19T08:00 elapsed gave.
		const display = screen.getByTestId("prisma-stopwatch-time");
		const text = display.textContent ?? "";
		const match = text.match(/^(\d{2}):(\d{2}):(\d{2})$/);
		expect(match).not.toBeNull();
		const [hh, mm] = [Number(match![1]), Number(match![2])];
		// ~1 hour elapsed since editedStart, allow a generous 5-minute window for
		// scheduler jitter in the test environment.
		expect(hh).toBe(1);
		expect(mm).toBeLessThanOrEqual(5);
	});

	// The user's exact reported flow: open edit modal, hit Continue while the
	// modal opened with start = T-9min, stop, edit start to T-5min, hit the
	// "▶ continue" labelled button (the standalone resume), then assert the
	// display now reflects T-5min (~5min elapsed) not T-9min. Before the fix,
	// resume preserved the original internal startTime regardless of edits.
	it("clicking ▶ continue after Stop adopts the edited Start Date", () => {
		const nineMinAgo = new Date(Date.now() - 9 * 60 * 1000);
		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
		const initialIso = formatLocal(nineMinAgo);
		const editedIso = formatLocal(fiveMinAgo);

		const bundle = createMockBundleWithStopwatch();
		render(
			<EventForm
				mode="edit"
				bundle={bundle}
				initialState={{
					...createDefaultState(),
					start: initialIso,
					end: formatLocal(new Date()),
					title: "Tracked",
				}}
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
			/>
		);

		// 1. Hit the idle ▶ continue — stopwatch picks up start = T-9min.
		act(() => {
			fireEvent.click(screen.getByTestId("prisma-stopwatch-btn-continue"));
		});

		// 2. User edits Start Date to T-5min.
		const startInput = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		act(() => {
			fireEvent.change(startInput, { target: { value: editedIso } });
		});
		expect(startInput.value).toBe(editedIso);

		// 3. User clicks Stop. Display freezes at ~9min.
		act(() => {
			fireEvent.click(screen.getByTestId("prisma-stopwatch-btn-stop"));
		});

		// 4. User clicks "▶ continue" (the standalone resume button).
		act(() => {
			fireEvent.click(screen.getByTestId("prisma-stopwatch-btn-resume"));
		});

		const display = screen.getByTestId("prisma-stopwatch-time");
		const match = (display.textContent ?? "").match(/^(\d{2}):(\d{2}):(\d{2})$/);
		expect(match).not.toBeNull();
		const totalMin = Number(match![1]) * 60 + Number(match![2]);
		// Acceptance window: ~5min elapsed (4-6 absorbs scheduler jitter).
		// The bug would land at ~9min (the seeded start), which this rejects.
		expect(totalMin).toBeGreaterThanOrEqual(4);
		expect(totalMin).toBeLessThanOrEqual(6);
	});
});

function formatLocal(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const mi = String(d.getMinutes()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
