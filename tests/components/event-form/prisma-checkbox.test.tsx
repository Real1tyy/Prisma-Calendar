import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PrismaCheckbox } from "../../../src/react/event-form/prisma-checkbox";

function PlainHarness({ initial = false }: { initial?: boolean }) {
	const [value, setValue] = useState(initial);
	return <PrismaCheckbox style="plain" value={value} onChange={setValue} testId="prisma-test-plain" />;
}

function LabeledHarness({ initial = false, label = "Virtual" }: { initial?: boolean; label?: string }) {
	const [value, setValue] = useState(initial);
	return (
		<PrismaCheckbox
			style="labeled-toggle"
			label={label}
			value={value}
			onChange={setValue}
			testId="prisma-test-labeled"
		/>
	);
}

describe("PrismaCheckbox", () => {
	describe("style=plain (default)", () => {
		it("emits the imperative DOM contract: <input type=checkbox class=prisma-setting-item-control>", () => {
			render(<PlainHarness />);
			const cb = screen.getByTestId("prisma-test-plain") as HTMLInputElement;
			expect(cb.tagName).toBe("INPUT");
			expect(cb.type).toBe("checkbox");
			expect(cb.className).toBe("prisma-setting-item-control");
		});

		it("does NOT wrap in a prisma-virtual-toggle div", () => {
			render(<PlainHarness />);
			expect(document.querySelector(".prisma-virtual-toggle")).toBeNull();
		});

		it("reflects the value prop", () => {
			render(<PlainHarness initial={true} />);
			const cb = screen.getByTestId("prisma-test-plain") as HTMLInputElement;
			expect(cb.checked).toBe(true);
		});

		it("calls onChange with boolean when toggled", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<PrismaCheckbox style="plain" value={false} onChange={onChange} testId="t" />);
			await user.click(screen.getByTestId("t"));
			expect(onChange).toHaveBeenCalledWith(true);
		});

		it("omits data-testid when no testId provided", () => {
			render(<PrismaCheckbox style="plain" value={false} onChange={() => {}} />);
			const cb = document.querySelector("input.prisma-setting-item-control") as HTMLInputElement;
			expect(cb.getAttribute("data-testid")).toBeNull();
		});

		it("honours disabled", () => {
			render(<PrismaCheckbox style="plain" value={false} onChange={() => {}} disabled testId="t" />);
			const cb = screen.getByTestId("t") as HTMLInputElement;
			expect(cb.disabled).toBe(true);
		});

		it("defaults to plain when no style is provided", () => {
			render(<PrismaCheckbox value={false} onChange={() => {}} testId="t" />);
			const cb = screen.getByTestId("t") as HTMLInputElement;
			expect(cb.className).toBe("prisma-setting-item-control");
		});
	});

	describe("style=labeled-toggle", () => {
		it("emits the imperative DOM contract: wrapper + label span + checkbox input", () => {
			render(<LabeledHarness />);
			const wrapper = document.querySelector(".prisma-virtual-toggle");
			expect(wrapper).not.toBeNull();
			const label = wrapper!.querySelector(".prisma-virtual-toggle-label");
			expect(label).not.toBeNull();
			expect(label!.textContent).toBe("Virtual");
			const cb = wrapper!.querySelector("input.prisma-virtual-toggle-checkbox") as HTMLInputElement;
			expect(cb).not.toBeNull();
			expect(cb.type).toBe("checkbox");
		});

		it("does NOT use the prisma-setting-item-control class", () => {
			render(<LabeledHarness />);
			expect(document.querySelector("input.prisma-setting-item-control")).toBeNull();
		});

		it("reflects the value prop", () => {
			render(<LabeledHarness initial={true} />);
			const cb = screen.getByTestId("prisma-test-labeled") as HTMLInputElement;
			expect(cb.checked).toBe(true);
		});

		it("calls onChange with boolean when checkbox is clicked", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<PrismaCheckbox style="labeled-toggle" label="Virtual" value={false} onChange={onChange} testId="t" />);
			await user.click(screen.getByTestId("t"));
			expect(onChange).toHaveBeenCalledWith(true);
		});

		it("toggles when the label is clicked", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<PrismaCheckbox style="labeled-toggle" label="Virtual" value={false} onChange={onChange} testId="t" />);
			await user.click(screen.getByText("Virtual"));
			expect(onChange).toHaveBeenCalledWith(true);
		});

		it("accepts a custom label", () => {
			render(<LabeledHarness label="All day" />);
			expect(screen.getByText("All day")).toBeTruthy();
		});

		it("honours disabled", () => {
			render(
				<PrismaCheckbox style="labeled-toggle" label="Virtual" value={false} onChange={() => {}} disabled testId="t" />
			);
			const cb = screen.getByTestId("t") as HTMLInputElement;
			expect(cb.disabled).toBe(true);
		});
	});

});
