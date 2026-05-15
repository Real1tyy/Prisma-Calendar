import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { createDefaultState, type EventFormState } from "../../../src/components/modals/event/event-form-state";
import { NotificationSection } from "../../../src/react/event-form/sections/notification-section";

function Wrapper({ initial }: { initial?: Partial<EventFormState> }) {
	const defaults = { ...createDefaultState(), ...initial };
	const form = useForm<EventFormState>({ defaultValues: defaults });
	return <NotificationSection form={form} />;
}

describe("NotificationSection", () => {
	it("renders the minutes label when allDay is false", () => {
		render(<Wrapper initial={{ allDay: false }} />);
		expect(screen.getByText("Notify minutes before")).toBeTruthy();
	});

	it("renders the days label when allDay is true", () => {
		render(<Wrapper initial={{ allDay: true }} />);
		expect(screen.getByText("Notify days before")).toBeTruthy();
	});

	it("renders the initial notifyBefore value", () => {
		render(<Wrapper initial={{ notifyBefore: "30" }} />);
		const input = screen.getByTestId("prisma-event-control-notify-before") as HTMLInputElement;
		expect(input.value).toBe("30");
	});

	it("updates the field as the user types", async () => {
		const user = userEvent.setup();
		render(<Wrapper initial={{ notifyBefore: "" }} />);

		const input = screen.getByTestId("prisma-event-control-notify-before") as HTMLInputElement;
		await user.type(input, "15");

		expect(input.value).toBe("15");
	});
});
