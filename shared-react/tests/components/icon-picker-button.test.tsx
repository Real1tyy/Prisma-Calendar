import type * as ObsidianMockModule from "@real1ty-obsidian-plugins/testing";
import { screen } from "@testing-library/react";
import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { IconPickerButton, useIconPicker } from "../../src/components/icon-picker-button";
import { AppContext } from "../../src/contexts/app-context";
import { renderReact } from "../helpers/render-react";

const showIconPickerMock = vi.fn();
vi.mock("../../../shared/src/components/primitives/icon-picker", () => ({
	showIconPicker: (app: App, onDone: (icon: string) => void) => showIconPickerMock(app, onDone),
}));

vi.mock("obsidian", async () => {
	const actual = await vi.importActual<typeof ObsidianMockModule>("@real1ty-obsidian-plugins/testing");
	return {
		...actual,
		setIcon: vi.fn((el: HTMLElement, icon: string) => {
			el.setAttribute("data-icon", icon);
		}),
	};
});

const fakeApp = { fake: true } as unknown as App;

describe("useIconPicker", () => {
	it("returns a function that forwards to showIconPicker using the explicit app", async () => {
		showIconPickerMock.mockReset();

		function Harness() {
			const open = useIconPicker(fakeApp);
			return (
				<button type="button" onClick={() => open((icon) => icon)}>
					open
				</button>
			);
		}

		const { user } = renderReact(<Harness />);
		await user.click(screen.getByRole("button", { name: "open" }));

		expect(showIconPickerMock).toHaveBeenCalledTimes(1);
		expect(showIconPickerMock.mock.calls[0][0]).toBe(fakeApp);
	});

	it("falls back to AppContext when no explicit app is passed", async () => {
		showIconPickerMock.mockReset();

		function Harness() {
			const open = useIconPicker();
			return (
				<button type="button" onClick={() => open(() => undefined)}>
					open
				</button>
			);
		}

		const { user } = renderReact(
			<AppContext value={fakeApp}>
				<Harness />
			</AppContext>
		);
		await user.click(screen.getByRole("button", { name: "open" }));

		expect(showIconPickerMock.mock.calls[0][0]).toBe(fakeApp);
	});
});

describe("IconPickerButton", () => {
	it("renders the current icon", () => {
		const { container } = renderReact(<IconPickerButton value="calendar" onChange={vi.fn()} app={fakeApp} />);
		expect(container.querySelector("[data-icon='calendar']")).not.toBeNull();
	});

	it("opens the picker on click and passes onChange through", async () => {
		showIconPickerMock.mockReset();
		const onChange = vi.fn();
		const { user } = renderReact(<IconPickerButton value="calendar" onChange={onChange} app={fakeApp} />);

		await user.click(screen.getByRole("button", { name: "Pick icon" }));

		expect(showIconPickerMock).toHaveBeenCalledTimes(1);
		const captured = showIconPickerMock.mock.calls[0][1] as (icon: string) => void;
		captured("search");
		expect(onChange).toHaveBeenCalledExactlyOnceWith("search");
	});

	it("applies a custom aria-label", () => {
		renderReact(<IconPickerButton value="calendar" onChange={vi.fn()} app={fakeApp} ariaLabel="Change icon" />);
		expect(screen.getByRole("button", { name: "Change icon" })).toBeInTheDocument();
	});
});
