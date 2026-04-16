import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ColorInput, DateInput, DatetimeLocalInput } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

describe("DateInput", () => {
	it("renders the value and sets type=date", () => {
		const { container } = renderReact(<DateInput value="2026-04-13" onChange={vi.fn()} />);
		const input = container.querySelector("input[type='date']") as HTMLInputElement;

		expect(input).not.toBeNull();
		expect(input).toHaveValue("2026-04-13");
	});

	it("fires onChange with the new date string", () => {
		function Harness() {
			const [v, setV] = useState("2026-01-01");
			return <DateInput value={v} onChange={setV} />;
		}
		const { container } = renderReact(<Harness />);
		const input = container.querySelector("input[type='date']") as HTMLInputElement;

		input.value = "2026-12-31";
		input.dispatchEvent(new Event("change", { bubbles: true }));

		expect(input).toHaveValue("2026-12-31");
	});

	it("reflects external `value` updates from the parent", () => {
		const { container, rerender } = renderReact(<DateInput value="2026-01-01" onChange={vi.fn()} />);
		expect(container.querySelector("input")).toHaveValue("2026-01-01");

		rerender(<DateInput value="2027-06-15" onChange={vi.fn()} />);
		expect(container.querySelector("input")).toHaveValue("2027-06-15");
	});
});

describe("DatetimeLocalInput", () => {
	it("renders the value and sets type=datetime-local", () => {
		const { container } = renderReact(<DatetimeLocalInput value="2026-04-13T09:30" onChange={vi.fn()} />);
		const input = container.querySelector("input[type='datetime-local']") as HTMLInputElement;

		expect(input).not.toBeNull();
		expect(input).toHaveValue("2026-04-13T09:30");
	});

	it("reflects external `value` updates from the parent", () => {
		const { container, rerender } = renderReact(<DatetimeLocalInput value="2026-04-13T09:30" onChange={vi.fn()} />);
		rerender(<DatetimeLocalInput value="2026-04-13T18:00" onChange={vi.fn()} />);
		expect(container.querySelector("input")).toHaveValue("2026-04-13T18:00");
	});
});

describe("ColorInput", () => {
	it("renders the value and sets type=color", () => {
		const { container } = renderReact(<ColorInput value="#ff0000" onChange={vi.fn()} />);
		const input = container.querySelector("input[type='color']") as HTMLInputElement;

		expect(input).not.toBeNull();
		expect(input).toHaveValue("#ff0000");
	});

	it("falls back to #000000 when `value` is empty", () => {
		const { container } = renderReact(<ColorInput value="" onChange={vi.fn()} />);
		expect(container.querySelector("input")).toHaveValue("#000000");
	});

	it("reflects external `value` updates from the parent", () => {
		const { container, rerender } = renderReact(<ColorInput value="#ff0000" onChange={vi.fn()} />);
		rerender(<ColorInput value="#00ff00" onChange={vi.fn()} />);
		expect(container.querySelector("input")).toHaveValue("#00ff00");
	});
});
