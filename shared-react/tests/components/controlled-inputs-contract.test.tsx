import { act } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

import {
	ColorInput,
	DateInput,
	DatetimeLocalInput,
	NumberInput,
	Slider,
	TextareaInput,
	TextInput,
} from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

/**
 * Central contract every controlled input must satisfy. Catches stale-value
 * bugs (the class that TextareaInput shipped with) BEFORE they hit the field —
 * adding a new controlled input without an entry here causes the suite not to
 * cover it, which is then a PR-review concern.
 *
 * If you add a new controlled input to `setting-controls.tsx`, append it here.
 */
interface Case<T> {
	name: string;
	Component: ComponentType<{ value: T; onChange: (v: T) => void; [k: string]: unknown }>;
	initial: T;
	updated: T;
	/** How to read the DOM value back — branches on input type family. */
	read: (container: HTMLElement) => string;
	/** Extra props required by the component (e.g. Slider needs min/max). */
	extraProps?: Record<string, unknown>;
}

const cases: Array<Case<string> | Case<number>> = [
	{
		name: "TextInput",
		Component: TextInput,
		initial: "first",
		updated: "second",
		read: (c) => (c.querySelector("input[type='text']") as HTMLInputElement).value,
	},
	{
		name: "TextareaInput",
		Component: TextareaInput,
		initial: "first",
		updated: "second",
		read: (c) => (c.querySelector("textarea") as HTMLTextAreaElement).value,
	},
	{
		name: "NumberInput",
		Component: NumberInput,
		initial: 1,
		updated: 9,
		read: (c) => (c.querySelector("input[type='number']") as HTMLInputElement).value,
	},
	{
		name: "DateInput",
		Component: DateInput,
		initial: "2026-01-01",
		updated: "2027-06-15",
		read: (c) => (c.querySelector("input[type='date']") as HTMLInputElement).value,
	},
	{
		name: "DatetimeLocalInput",
		Component: DatetimeLocalInput,
		initial: "2026-01-01T09:00",
		updated: "2027-06-15T18:30",
		read: (c) => (c.querySelector("input[type='datetime-local']") as HTMLInputElement).value,
	},
	{
		name: "ColorInput",
		Component: ColorInput,
		initial: "#ff0000",
		updated: "#00ff00",
		read: (c) => (c.querySelector("input[type='color']") as HTMLInputElement).value,
	},
	{
		name: "Slider",
		Component: Slider,
		initial: 3,
		updated: 8,
		read: (c) => (c.querySelector("input[type='range']") as HTMLInputElement).value,
		extraProps: { min: 0, max: 10 },
	},
];

describe("Controlled-input contract", () => {
	for (const c of cases) {
		describe(c.name, () => {
			it("renders the initial `value` prop", () => {
				const { container } = renderReact(
					<c.Component value={c.initial as never} onChange={vi.fn()} {...c.extraProps} />
				);
				expect(c.read(container)).toBe(String(c.initial));
			});

			it("reflects external `value` updates from the parent (no stale state)", () => {
				const { container, rerender } = renderReact(
					<c.Component value={c.initial as never} onChange={vi.fn()} {...c.extraProps} />
				);
				expect(c.read(container)).toBe(String(c.initial));

				act(() => {
					rerender(<c.Component value={c.updated as never} onChange={vi.fn()} {...c.extraProps} />);
				});

				expect(c.read(container)).toBe(String(c.updated));
			});
		});
	}
});
