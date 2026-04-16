import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toggle } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

describe("Toggle", () => {
	it("exposes a switch role reflecting the current value", () => {
		renderReact(<Toggle value={false} onChange={vi.fn()} />);
		const toggle = screen.getByRole("switch");

		expect(toggle).toHaveAttribute("aria-checked", "false");
		expect(toggle).not.toHaveClass("is-enabled");
	});

	it("renders the `is-enabled` class when value is true", () => {
		renderReact(<Toggle value={true} onChange={vi.fn()} />);
		const toggle = screen.getByRole("switch");

		expect(toggle).toHaveAttribute("aria-checked", "true");
		expect(toggle).toHaveClass("is-enabled");
	});

	it("invokes onChange with the inverse on click", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<Toggle value={false} onChange={onChange} />);

		await user.click(screen.getByRole("switch"));

		expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
	});

	it("toggles on Enter and Space keypresses", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<Toggle value={false} onChange={onChange} />);
		const toggle = screen.getByRole("switch");
		toggle.focus();

		await user.keyboard("{Enter}");
		expect(onChange).toHaveBeenNthCalledWith(1, true);

		await user.keyboard(" ");
		expect(onChange).toHaveBeenNthCalledWith(2, true);
	});

	it("reflects a new value prop without losing focus", () => {
		const { rerender } = renderReact(<Toggle value={false} onChange={vi.fn()} />);
		expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

		rerender(<Toggle value={true} onChange={vi.fn()} />);
		expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
		expect(screen.getByRole("switch")).toHaveClass("is-enabled");
	});
});
