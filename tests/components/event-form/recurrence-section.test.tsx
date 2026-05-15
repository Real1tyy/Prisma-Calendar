import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import { RecurrenceSection } from "../../../src/react/event-form/sections/recurrence-section";

function Wrapper({ initial }: { initial?: Partial<EventFormState> }) {
	const defaults = { ...createDefaultState(), ...initial };
	const form = useForm<EventFormState>({ defaultValues: defaults });
	return <RecurrenceSection form={form} />;
}

describe("RecurrenceSection", () => {
	it("shows toggle in collapsed state by default", () => {
		render(<Wrapper />);
		expect(screen.getByTestId("prisma-event-control-rrule")).toBeTruthy();
		expect(screen.queryByTestId("prisma-event-control-rrule-type")).toBeNull();
	});

	it("shows recurrence fields when enabled", () => {
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }} />
		);
		expect(screen.getByTestId("prisma-event-control-rrule-type")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-rrule-until")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-future-instances-count")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-generate-past-events")).toBeTruthy();
	});

	it("shows weekday grid for weekly recurrence", () => {
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "weekly" } }} />
		);
		expect(screen.getByTestId("prisma-event-control-weekday-monday")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-weekday-friday")).toBeTruthy();
	});

	it("expands when toggle is clicked", async () => {
		const user = userEvent.setup();
		render(<Wrapper />);

		await user.click(screen.getByTestId("prisma-event-control-rrule"));
		expect(screen.getByTestId("prisma-event-control-rrule-type")).toBeTruthy();
	});

	it("hides the weekday grid for monthly recurrence", () => {
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "monthly" } }} />
		);
		expect(screen.queryByTestId("prisma-event-control-weekday-monday")).toBeNull();
	});

	it("shows the custom interval controls when 'Custom interval...' is selected", async () => {
		const user = userEvent.setup();
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "daily" } }} />
		);

		const select = screen.getByTestId("prisma-event-control-rrule-type") as HTMLSelectElement;
		await user.selectOptions(select, "custom");

		expect(screen.getByTestId("prisma-event-control-custom-interval")).toBeTruthy();
		expect(screen.getByTestId("prisma-event-control-custom-freq")).toBeTruthy();
	});

	it("locks Mon–Fri as fixed (checked + disabled) for the 'weekdays' preset", () => {
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "weekdays" } }} />
		);
		for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"]) {
			const cb = screen.getByTestId(`prisma-event-control-weekday-${day}`) as HTMLInputElement;
			expect(cb.checked).toBe(true);
			expect(cb.disabled).toBe(true);
		}
	});

	it("locks Sat–Sun as fixed for the 'weekends' preset", () => {
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "weekends" } }} />
		);
		const saturday = screen.getByTestId("prisma-event-control-weekday-saturday") as HTMLInputElement;
		const sunday = screen.getByTestId("prisma-event-control-weekday-sunday") as HTMLInputElement;
		expect(saturday.checked).toBe(true);
		expect(saturday.disabled).toBe(true);
		expect(sunday.checked).toBe(true);
		expect(sunday.disabled).toBe(true);
	});

	it("toggles a user-selected weekday on weekly recurrence", async () => {
		const user = userEvent.setup();
		render(
			<Wrapper initial={{ recurring: { ...createDefaultState().recurring, enabled: true, rruleType: "weekly" } }} />
		);

		const monday = screen.getByTestId("prisma-event-control-weekday-monday") as HTMLInputElement;
		expect(monday.disabled).toBe(false);
		expect(monday.checked).toBe(false);

		await user.click(monday);
		expect(monday.checked).toBe(true);
	});

	it("renders existing untilDate / futureInstancesCount values from form state", () => {
		render(
			<Wrapper
				initial={{
					recurring: {
						...createDefaultState().recurring,
						enabled: true,
						rruleType: "weekly",
						untilDate: "2026-12-31",
						futureInstancesCount: "7",
					},
				}}
			/>
		);
		const until = screen.getByTestId("prisma-event-control-rrule-until") as HTMLInputElement;
		const futureCount = screen.getByTestId("prisma-event-control-future-instances-count") as HTMLInputElement;
		expect(until.value).toBe("2026-12-31");
		expect(futureCount.value).toBe("7");
	});
});
