import type * as ObsidianMockModule from "@real1ty-obsidian-plugins/testing";
import { screen } from "@testing-library/react";
import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { AppContext } from "../../../src/contexts/app-context";
import { IconPickerButton, useIconPicker } from "../../../src/widgets/icon-picker/icon-picker-button";
import { renderReact } from "../../helpers/render-react";

const showReactIconPickerMock = vi.fn();
vi.mock("../../../src/modals/icon-picker-modal", () => ({
	showReactIconPicker: (app: App, onDone: (icon: string | null) => void) => showReactIconPickerMock(app, onDone),
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
	it("returns a function that forwards to showReactIconPicker using the explicit app", async () => {
		showReactIconPickerMock.mockReset();

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

		expect(showReactIconPickerMock).toHaveBeenCalledTimes(1);
		expect(showReactIconPickerMock.mock.calls[0][0]).toBe(fakeApp);
	});

	it("falls back to AppContext when no explicit app is passed", async () => {
		showReactIconPickerMock.mockReset();

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

		expect(showReactIconPickerMock.mock.calls[0][0]).toBe(fakeApp);
	});
});

describe("IconPickerButton", () => {
	it("renders the current icon", () => {
		const { container } = renderReact(<IconPickerButton value="calendar" onChange={vi.fn()} app={fakeApp} />);
		expect(container.querySelector("[data-icon='calendar']")).not.toBeNull();
	});

	it("opens the picker on click and passes onChange through", async () => {
		showReactIconPickerMock.mockReset();
		const onChange = vi.fn();
		const { user } = renderReact(<IconPickerButton value="calendar" onChange={onChange} app={fakeApp} />);

		await user.click(screen.getByRole("button", { name: "Pick icon" }));

		expect(showReactIconPickerMock).toHaveBeenCalledTimes(1);
		const captured = showReactIconPickerMock.mock.calls[0][1] as (icon: string) => void;
		captured("search");
		expect(onChange).toHaveBeenCalledExactlyOnceWith("search");
	});

	it("applies a custom aria-label", () => {
		renderReact(<IconPickerButton value="calendar" onChange={vi.fn()} app={fakeApp} ariaLabel="Change icon" />);
		expect(screen.getByRole("button", { name: "Change icon" })).toBeInTheDocument();
	});
});
