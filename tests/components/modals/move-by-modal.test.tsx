import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MoveByForm } from "../../../src/react/modals/event/move-by-modal";
import { TIME_UNITS } from "../../../src/types/calendar";

function setup() {
	const onSubmit = vi.fn();
	const onCancel = vi.fn();
	const user = userEvent.setup();
	const result = render(<MoveByForm onSubmit={onSubmit} onCancel={onCancel} />);
	return { onSubmit, onCancel, user, ...result };
}

describe("MoveByForm", () => {
	it("renders all unit buttons", () => {
		setup();
		for (const unit of TIME_UNITS) {
			expect(screen.getByTestId(`prisma-move-by-unit-${unit}`)).toBeDefined();
		}
	});

	it("minutes unit is active by default", () => {
		setup();
		expect(screen.getByTestId("prisma-move-by-unit-minutes").className).toContain("prisma-is-active");
	});

	it("increment increases value", async () => {
		const { user } = setup();
		await user.click(screen.getByTestId("prisma-move-by-increment"));
		expect((screen.getByTestId("prisma-move-by-value") as HTMLInputElement).value).toBe("16");
	});

	it("decrement decreases value", async () => {
		const { user } = setup();
		await user.click(screen.getByTestId("prisma-move-by-decrement"));
		expect((screen.getByTestId("prisma-move-by-value") as HTMLInputElement).value).toBe("14");
	});

	it("toggle sign flips value", async () => {
		const { user } = setup();
		await user.click(screen.getByTestId("prisma-move-by-toggle-sign"));
		expect((screen.getByTestId("prisma-move-by-value") as HTMLInputElement).value).toBe("-15");
	});

	it("selecting a unit updates active state", async () => {
		const { user } = setup();
		await user.click(screen.getByTestId("prisma-move-by-unit-hours"));
		expect(screen.getByTestId("prisma-move-by-unit-hours").className).toContain("prisma-is-active");
		expect(screen.getByTestId("prisma-move-by-unit-minutes").className).not.toContain("prisma-is-active");
	});

	it("submit calls onSubmit with value and unit", async () => {
		const { user, onSubmit } = setup();
		await user.click(screen.getByTestId("prisma-move-by-unit-days"));
		await user.click(screen.getByTestId("prisma-form-submit"));
		expect(onSubmit).toHaveBeenCalledWith({ value: 15, unit: "days" });
	});

	it("toggle-sign then submit dispatches the negated value to onSubmit", async () => {
		const { user, onSubmit } = setup();
		await user.click(screen.getByTestId("prisma-move-by-unit-hours"));
		await user.click(screen.getByTestId("prisma-move-by-toggle-sign"));
		await user.click(screen.getByTestId("prisma-form-submit"));
		expect(onSubmit).toHaveBeenCalledWith({ value: -15, unit: "hours" });
	});

	it("cancel calls onCancel", async () => {
		const { user, onCancel } = setup();
		await user.click(screen.getByTestId("prisma-form-cancel"));
		expect(onCancel).toHaveBeenCalled();
	});
});
