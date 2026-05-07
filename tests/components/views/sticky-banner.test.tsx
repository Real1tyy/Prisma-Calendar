import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StickyBanner } from "../../../src/react/views/sticky-banner";

describe("StickyBanner", () => {
	it("renders the message and cancel button", () => {
		render(<StickyBanner message="Select a prerequisite" onCancel={vi.fn()} />);
		expect(screen.getByText("Select a prerequisite")).toBeInTheDocument();
		expect(screen.getByText("Cancel")).toBeInTheDocument();
	});

	it("calls onCancel when Cancel is clicked", async () => {
		const onCancel = vi.fn();
		const user = userEvent.setup();
		render(<StickyBanner message="Pick one" onCancel={onCancel} />);
		await user.click(screen.getByText("Cancel"));
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("has the correct testid", () => {
		render(<StickyBanner message="msg" onCancel={vi.fn()} />);
		expect(screen.getByTestId("prisma-sticky-banner")).toBeInTheDocument();
	});
});
