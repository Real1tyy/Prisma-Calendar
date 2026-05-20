import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import { TimingSection } from "../../../src/react/event-form/sections/timing-section";

function Wrapper({ initial, showDuration = false }: { initial?: Partial<EventFormState>; showDuration?: boolean }) {
	const defaults = { ...createDefaultState(), ...initial };
	const form = useForm<EventFormState>({ defaultValues: defaults });
	return <TimingSection form={form} showDurationField={showDuration} />;
}

describe("TimingSection", () => {
	it("shows timed fields when not all-day", () => {
		render(<Wrapper initial={{ allDay: false }} />);
		expect(screen.getByTestId("prisma-event-control-start")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-end")).toBeTruthy();
		expect(screen.queryByTestId("prisma-event-control-date")).toBeNull();
	});

	it("shows date field when all-day", () => {
		render(<Wrapper initial={{ allDay: true }} />);
		expect(screen.queryByTestId("prisma-event-control-start")).toBeNull();
		expect(screen.getByTestId("prisma-event-control-date")).toBeTruthy();
	});

	it("toggles between timed and all-day fields", async () => {
		const user = userEvent.setup();
		render(<Wrapper initial={{ allDay: false }} />);

		expect(screen.getByTestId("prisma-event-control-start")).toBeTruthy();

		await user.click(screen.getByTestId("prisma-event-control-all-day"));

		expect(screen.queryByTestId("prisma-event-control-start")).toBeNull();
		expect(screen.getByTestId("prisma-event-control-date")).toBeTruthy();
	});

	it("shows duration field when enabled", () => {
		render(<Wrapper initial={{ allDay: false }} showDuration={true} />);
		expect(screen.getByTestId("prisma-event-control-duration")).toBeTruthy();
	});

	it("hides duration field when disabled", () => {
		render(<Wrapper initial={{ allDay: false }} showDuration={false} />);
		expect(screen.queryByTestId("prisma-event-control-duration")).toBeNull();
	});

	it("renders initial start/end values", () => {
		render(
			<Wrapper
				initial={{
					allDay: false,
					start: "2026-04-25T09:00",
					end: "2026-04-25T10:00",
				}}
			/>
		);

		const startInput = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		const endInput = screen.getByTestId("prisma-event-control-end") as HTMLInputElement;
		expect(startInput.value).toBe("2026-04-25T09:00");
		expect(endInput.value).toBe("2026-04-25T10:00");
	});

	it("computes the duration from start/end when the duration field is shown", () => {
		render(
			<Wrapper
				initial={{
					allDay: false,
					start: "2026-04-25T09:00",
					end: "2026-04-25T10:30",
				}}
				showDuration={true}
			/>
		);
		const duration = screen.getByTestId("prisma-event-control-duration") as HTMLInputElement;
		expect(duration.value).toBe("90");
	});

	it("recomputes the end time when the duration is edited", () => {
		render(
			<Wrapper
				initial={{
					allDay: false,
					start: "2026-04-25T09:00",
					end: "2026-04-25T10:00",
				}}
				showDuration={true}
			/>
		);

		const duration = screen.getByTestId("prisma-event-control-duration") as HTMLInputElement;
		const end = screen.getByTestId("prisma-event-control-end") as HTMLInputElement;

		fireEvent.change(duration, { target: { value: "120" } });

		expect(end.value.slice(0, 16)).toBe("2026-04-25T11:00");
	});

	it("populates the date field from the existing start when toggling all-day on", async () => {
		const user = userEvent.setup();
		render(
			<Wrapper
				initial={{
					allDay: false,
					start: "2026-04-25T09:30",
					end: "2026-04-25T10:30",
				}}
			/>
		);

		await user.click(screen.getByTestId("prisma-event-control-all-day"));

		const dateInput = screen.getByTestId("prisma-event-control-date") as HTMLInputElement;
		expect(dateInput.value).toBe("2026-04-25");
	});

	it("populates start/end with default 09:00–10:00 when toggling all-day off (with date set)", async () => {
		const user = userEvent.setup();
		render(<Wrapper initial={{ allDay: true, date: "2026-04-25" }} />);

		await user.click(screen.getByTestId("prisma-event-control-all-day"));

		const start = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		const end = screen.getByTestId("prisma-event-control-end") as HTMLInputElement;
		expect(start.value).toBe("2026-04-25T09:00");
		expect(end.value).toBe("2026-04-25T10:00");
	});

	it("renders Now buttons that overwrite the start/end fields", async () => {
		const user = userEvent.setup();
		render(<Wrapper initial={{ allDay: false, start: "", end: "" }} />);

		const start = screen.getByTestId("prisma-event-control-start") as HTMLInputElement;
		const buttons = screen.getAllByText("Now");
		await user.click(buttons[0]);

		expect(start.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
	});
});
