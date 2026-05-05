import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarCheckboxes } from "../../../src/react/modals/caldav/calendar-checkboxes";

const CALENDARS = [
	{ url: "https://cal.example.com/work", displayName: "Work" },
	{ url: "https://cal.example.com/personal", displayName: "Personal", description: "My personal calendar" },
];

describe("CalendarCheckboxes", () => {
	it("renders empty state when no calendars provided", () => {
		render(<CalendarCheckboxes calendars={[]} selected={[]} onChange={vi.fn()} />);
		expect(screen.getByText(/test connection to discover/i)).toBeDefined();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("renders a checkbox for each calendar", () => {
		render(<CalendarCheckboxes calendars={CALENDARS} selected={[]} onChange={vi.fn()} />);
		expect(screen.getByText("Work")).toBeDefined();
		expect(screen.getByText("Personal")).toBeDefined();
		expect(screen.getAllByRole("checkbox")).toHaveLength(2);
	});

	it("shows description when provided", () => {
		render(<CalendarCheckboxes calendars={CALENDARS} selected={[]} onChange={vi.fn()} />);
		expect(screen.getByText(/my personal calendar/i)).toBeDefined();
	});

	it("checks only selected calendars", () => {
		render(<CalendarCheckboxes calendars={CALENDARS} selected={["https://cal.example.com/work"]} onChange={vi.fn()} />);
		const work = screen.getByTestId("prisma-caldav-calendar-https://cal.example.com/work") as HTMLInputElement;
		const personal = screen.getByTestId("prisma-caldav-calendar-https://cal.example.com/personal") as HTMLInputElement;
		expect(work.checked).toBe(true);
		expect(personal.checked).toBe(false);
	});

	it("adds URL to selection when unchecked calendar is toggled", async () => {
		const onChange = vi.fn();
		render(<CalendarCheckboxes calendars={CALENDARS} selected={[]} onChange={onChange} />);

		await userEvent.click(screen.getByTestId("prisma-caldav-calendar-https://cal.example.com/work"));
		expect(onChange).toHaveBeenCalledWith(["https://cal.example.com/work"]);
	});

	it("removes URL from selection when checked calendar is toggled", async () => {
		const onChange = vi.fn();
		const bothSelected = CALENDARS.map((c) => c.url);
		render(<CalendarCheckboxes calendars={CALENDARS} selected={bothSelected} onChange={onChange} />);

		await userEvent.click(screen.getByTestId("prisma-caldav-calendar-https://cal.example.com/work"));
		expect(onChange).toHaveBeenCalledWith(["https://cal.example.com/personal"]);
	});
});
