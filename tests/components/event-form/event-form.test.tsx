import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../../src/core/calendar-bundle";
import { EventForm, type EventFormValues } from "../../../src/react/event-form/event-form";
import type { SingleCalendarConfig } from "../../../src/types/settings";
import { createMockSingleCalendarSettings } from "../../fixtures/settings-fixtures";

function createMockBundle(overrides: Partial<SingleCalendarConfig> = {}): CalendarBundle {
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
		enableNotifications: true,
		showStopwatch: false,
		showDurationField: true,
		eventPresets: [],
		defaultPresetId: "",
		titleAutocomplete: false,
		autoAssignCategoryByName: false,
		categoryAssignmentPresets: [],
		defaultNodeColor: "#7e7e7e",
		frontmatterDisplayProperties: [],
		frontmatterDisplayPropertiesAllDay: [],
		...overrides,
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
			getCategories: () => ["Work", "Personal"],
			getCategoriesWithColors: () => [
				{ name: "Work", color: "#ff0000" },
				{ name: "Personal", color: "#00ff00" },
			],
		},
		plugin: {
			app: {} as never,
			isProEnabled: false,
			syncStore: { data: { readOnly: false } },
			calendarBundles: [],
		},
	} as unknown as CalendarBundle;
}

describe("EventForm", () => {
	it("renders create mode with title, allDay toggle, and action buttons", () => {
		const bundle = createMockBundle();
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByText("Create Event")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-title")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-all-day")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-btn-save")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-btn-cancel")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-btn-minimize")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-btn-clear")).toBeTruthy();
	});

	it("renders edit mode with correct button text", () => {
		const bundle = createMockBundle();
		render(<EventForm mode="edit" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByText("Edit Event")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-btn-save").textContent).toBe("Save");
	});

	it("renders with initial state values", () => {
		const bundle = createMockBundle();
		const initial: EventFormState = {
			...createDefaultState(),
			title: "Team Meeting",
			allDay: false,
			start: "2026-04-25T09:00",
			end: "2026-04-25T10:00",
		};

		render(<EventForm mode="edit" bundle={bundle} initialState={initial} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		expect(titleInput.value).toBe("Team Meeting");
	});

	it("calls onCancel when cancel is clicked", async () => {
		const onCancel = vi.fn();
		const bundle = createMockBundle();
		const user = userEvent.setup();

		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={onCancel} />);

		await user.click(screen.getByTestId("prisma-event-btn-cancel"));
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("calls onSubmit with form values when save is clicked", async () => {
		const onSubmit = vi.fn();
		const bundle = createMockBundle();
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
		await user.type(titleInput, "Weekly Review");
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).toHaveBeenCalledOnce();
		const values: EventFormValues = onSubmit.mock.calls[0][0];
		expect(values.formState.title).toBe("Weekly Review");
	});

	it("calls onMinimize with form values", async () => {
		const onMinimize = vi.fn();
		const bundle = createMockBundle();
		const user = userEvent.setup();

		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} onMinimize={onMinimize} />);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(titleInput, "Test Event");
		await user.click(screen.getByTestId("prisma-event-btn-minimize"));

		expect(onMinimize).toHaveBeenCalledOnce();
		const values: EventFormValues = onMinimize.mock.calls[0][0];
		expect(values.formState.title).toBe("Test Event");
	});

	it("clears all fields when clear button is clicked", async () => {
		const bundle = createMockBundle();
		const user = userEvent.setup();

		const initial: EventFormState = {
			...createDefaultState(),
			title: "Filled Event",
			start: "2026-04-25T09:00",
		};

		render(<EventForm mode="create" bundle={bundle} initialState={initial} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		expect(titleInput.value).toBe("Filled Event");

		await user.click(screen.getByTestId("prisma-event-btn-clear"));

		expect(titleInput.value).toBe("");
	});

	it("shows notification field when notifications enabled", () => {
		const bundle = createMockBundle({ enableNotifications: true });
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByTestId("prisma-event-control-notify-before")).toBeTruthy();
	});

	it("hides notification field when notifications disabled", () => {
		const bundle = createMockBundle({ enableNotifications: false });
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.queryByTestId("prisma-event-control-notify-before")).toBeNull();
	});

	it("shows recurrence fields when recurring toggle is checked", async () => {
		const bundle = createMockBundle();
		const user = userEvent.setup();

		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const rruleToggle = screen.getByTestId("prisma-event-control-rrule");
		await user.click(rruleToggle);

		expect(screen.getByTestId("prisma-event-control-rrule-type")).toBeTruthy();
	});

	it("renders preset selector", () => {
		const bundle = createMockBundle({
			eventPresets: [{ id: "p1", name: "Quick Meeting", createdAt: Date.now() }] as never,
		});

		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByTestId("prisma-event-control-preset")).toBeTruthy();
	});

	it("shows save preset button when onSavePreset is provided", () => {
		const bundle = createMockBundle();
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} onSavePreset={vi.fn()} />);

		expect(screen.getByTestId("prisma-event-btn-save-preset")).toBeTruthy();
	});

	it("blocks save when the title contains characters illegal in filenames", async () => {
		const bundle = createMockBundle();
		const onSubmit = vi.fn();
		const user = userEvent.setup();

		render(<EventForm mode="create" bundle={bundle} onSubmit={onSubmit} onCancel={vi.fn()} />);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		await user.type(titleInput, "Bad/Slash");
		await user.click(screen.getByTestId("prisma-event-btn-save"));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("applies a preset to the form when selected", async () => {
		const bundle = createMockBundle({
			eventPresets: [
				{
					id: "p1",
					name: "Workout",
					title: "Morning Workout",
					createdAt: Date.now(),
				},
			] as never,
		});
		const user = userEvent.setup();

		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		const titleInput = screen.getByTestId("prisma-event-control-title") as HTMLInputElement;
		expect(titleInput.value).toBe("");

		const presetSelect = screen.getByTestId("prisma-event-control-preset") as HTMLSelectElement;
		await user.selectOptions(presetSelect, "p1");

		expect(titleInput.value).toBe("Morning Workout");
	});

	it("renders Edit Event header with 'Save' button label in edit mode", () => {
		const bundle = createMockBundle();
		render(<EventForm mode="edit" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);
		expect(screen.getByText("Edit Event")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-btn-save").textContent).toBe("Save");
	});

	it("hides recurrence detail fields when the recurring toggle is off", () => {
		const bundle = createMockBundle();
		render(<EventForm mode="create" bundle={bundle} onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.queryByTestId("prisma-event-control-rrule-type")).toBeNull();
		expect(screen.queryByTestId("prisma-event-control-rrule-until")).toBeNull();
	});
});
