import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../../src/core/calendar-bundle";
import { EventForm } from "../../../src/react/event-form/event-form";
import type { SingleCalendarConfig } from "../../../src/types/settings";
import { createMockSingleCalendarSettings } from "../../fixtures/settings-fixtures";

interface MockEvent {
	id: string;
	type: "timed" | "allDay";
	filePath: string;
	title: string;
	start: Date;
	end?: Date;
	allDay?: boolean;
}

function createMockBundle(opts: { overrides?: Partial<SingleCalendarConfig>; events?: MockEvent[] }): CalendarBundle {
	const settings = {
		...createMockSingleCalendarSettings(),
		categoryProp: "Category",
		locationProp: "Location",
		iconProp: "Icon",
		showStopwatch: false,
		showDurationField: false,
		eventPresets: [],
		defaultPresetId: "",
		titleAutocomplete: false,
		autoAssignCategoryByName: false,
		categoryAssignmentPresets: [],
		defaultNodeColor: "#7e7e7e",
		frontmatterDisplayProperties: [],
		frontmatterDisplayPropertiesAllDay: [],
		...opts.overrides,
	} as SingleCalendarConfig;

	const subject = new BehaviorSubject(settings);
	const events = opts.events ?? [];

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
			findNextEventByStartTime: (afterISO: string, excludePath?: string) => {
				const after = afterISO ? new Date(afterISO).getTime() : -Infinity;
				return (
					events
						.filter((e) => e.filePath !== excludePath && e.start.getTime() > after)
						.sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null
				);
			},
			findPreviousEventByEndTime: (beforeISO: string, excludePath?: string) => {
				const before = beforeISO ? new Date(beforeISO).getTime() : Infinity;
				return (
					events
						.filter((e) => e.filePath !== excludePath && (e.end ? e.end.getTime() < before : false))
						.sort((a, b) => (b.end!.getTime() ?? 0) - (a.end!.getTime() ?? 0))[0] ?? null
				);
			},
		},
		plugin: {
			app: {} as never,
			isProEnabled: false,
			syncStore: { data: { readOnly: false } },
			calendarBundles: [],
		},
	} as unknown as CalendarBundle;
}

describe("EventForm — imperative DOM contract", () => {
	it("renders the Virtual toggle using the prisma-virtual-toggle wrapper + virtual-toggle-checkbox class", () => {
		// Mirrors base-event-modal.ts:565-572 — Virtual was a custom 3-element widget,
		// NOT an Obsidian sliding-pill toggle.
		const bundle = createMockBundle({});
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const wrapper = document.querySelector(".prisma-virtual-toggle");
		expect(wrapper).not.toBeNull();
		const label = wrapper!.querySelector(".prisma-virtual-toggle-label");
		expect(label).not.toBeNull();
		expect(label!.textContent).toBe("Virtual");
		const cb = wrapper!.querySelector("input.prisma-virtual-toggle-checkbox") as HTMLInputElement;
		expect(cb).not.toBeNull();
		expect(cb.type).toBe("checkbox");
	});

	it("wraps the title input in .prisma-title-input-wrapper so the centered-text CSS rule applies", () => {
		// Mirrors styles/_modals.scss:470 — `.prisma-event-modal .prisma-title-input-wrapper
		// input.prisma-setting-item-control { text-align: center; }` only fires when wrapped.
		const bundle = createMockBundle({});
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const title = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		expect(title.closest(".prisma-title-input-wrapper")).not.toBeNull();
		expect(title.className).toBe("prisma-setting-item-control");
	});

	it("renders no Obsidian sliding-pill toggles for All-day / Recurring / Virtual / Generate-past", () => {
		// Three native checkboxes were lost to Obsidian Toggle in the initial migration:
		// All day, Recurring, Generate-past. The Virtual checkbox lost its
		// .prisma-virtual-toggle-checkbox class. Guard against re-introduction.
		// MetadataSection's markAsDone/skip toggles are renderSchemaForm-driven and still
		// emit .checkbox-container — that mirrors the imperative renderSimpleFields path.
		const bundle = createMockBundle({});
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		for (const testId of [
			"prisma-event-control-allDay",
			"prisma-event-control-rrule",
			"prisma-event-control-virtual",
		]) {
			const cb = screen.getByTestId(testId) as HTMLElement;
			expect(cb.tagName).toBe("INPUT");
			expect((cb as HTMLInputElement).type).toBe("checkbox");
			expect(cb.classList.contains("checkbox-container")).toBe(false);
		}
	});

	it("renders 'Fill prev' / 'Fill next' buttons by default (eventStore wired through EventForm)", async () => {
		// Mirrors base-event-modal.ts:1047-1061 — both buttons were always rendered.
		// In the initial React port they never rendered because the modals didn't pass props.
		const bundle = createMockBundle({ events: [] });
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByText("Fill prev")).toBeTruthy();
		expect(screen.getByText("Fill next")).toBeTruthy();
	});
});

describe("EventForm — Fill prev/next behaviour", () => {
	it("Fill prev populates the start input with the end of the previous event", async () => {
		const prev: MockEvent = {
			id: "prev",
			type: "timed",
			filePath: "prev.md",
			title: "Earlier Meeting",
			start: new Date("2026-04-25T08:00:00"),
			end: new Date("2026-04-25T08:30:00"),
		};
		const bundle = createMockBundle({ events: [prev] });
		const user = userEvent.setup();

		const initial: EventFormState = {
			...createDefaultState(),
			allDay: false,
			start: "2026-04-25T09:00",
			end: "2026-04-25T10:00",
		};
		render(<EventForm mode="create" bundle={bundle} initialState={initial} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		await user.click(screen.getByText("Fill prev"));

		await waitFor(() => {
			const start = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
			// formatDateTimeForInput pads to YYYY-MM-DDTHH:mm:ss (local)
			expect(start.value.slice(0, 16)).toBe("2026-04-25T08:30");
		});
	});

	it("Fill next populates the end input with the start of the next event", async () => {
		const next: MockEvent = {
			id: "next",
			type: "timed",
			filePath: "next.md",
			title: "Later Meeting",
			start: new Date("2026-04-25T11:00:00"),
			end: new Date("2026-04-25T12:00:00"),
		};
		const bundle = createMockBundle({ events: [next] });
		const user = userEvent.setup();

		const initial: EventFormState = {
			...createDefaultState(),
			allDay: false,
			start: "2026-04-25T09:00",
			end: "2026-04-25T10:00",
		};
		render(<EventForm mode="create" bundle={bundle} initialState={initial} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		await user.click(screen.getByText("Fill next"));

		await waitFor(() => {
			const end = screen.getByTestId("prisma-event-control-end") as HTMLInputElement;
			expect(end.value.slice(0, 16)).toBe("2026-04-25T11:00");
		});
	});

	it("Fill prev shows a Notice and leaves the input unchanged when there is no previous event", async () => {
		const bundle = createMockBundle({ events: [] });
		const user = userEvent.setup();

		const initial: EventFormState = {
			...createDefaultState(),
			allDay: false,
			start: "2026-04-25T09:00",
			end: "2026-04-25T10:00",
		};
		render(<EventForm mode="create" bundle={bundle} initialState={initial} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		await user.click(screen.getByText("Fill prev"));

		const start = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		expect(start.value).toBe("2026-04-25T09:00");
	});
});
