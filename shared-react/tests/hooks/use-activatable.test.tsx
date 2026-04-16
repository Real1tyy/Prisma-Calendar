import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useActivatable } from "../../src/hooks/use-activatable";
import { renderReact } from "../helpers/render-react";

function Harness({ onActivate }: { onActivate: (() => void) | undefined }) {
	const activate = useActivatable(onActivate);
	return (
		<div {...activate} data-testid="target" role="button">
			target
		</div>
	);
}

describe("useActivatable", () => {
	it("returns tabIndex, onClick, onKeyDown when onActivate is provided", async () => {
		const onActivate = vi.fn();
		const { user } = renderReact(<Harness onActivate={onActivate} />);

		const el = screen.getByTestId("target");
		expect(el).toHaveAttribute("tabindex", "0");

		await user.click(el);
		expect(onActivate).toHaveBeenCalledTimes(1);
	});

	it("fires on Enter and Space keypresses", async () => {
		const onActivate = vi.fn();
		const { user } = renderReact(<Harness onActivate={onActivate} />);
		screen.getByTestId("target").focus();

		await user.keyboard("{Enter}");
		await user.keyboard(" ");

		expect(onActivate).toHaveBeenCalledTimes(2);
	});

	it("ignores other keys", async () => {
		const onActivate = vi.fn();
		const { user } = renderReact(<Harness onActivate={onActivate} />);
		screen.getByTestId("target").focus();

		await user.keyboard("a");
		await user.keyboard("{Escape}");

		expect(onActivate).not.toHaveBeenCalled();
	});

	it("ignores modifier-key combos (Shift/Alt/Ctrl/Meta + Enter)", async () => {
		const onActivate = vi.fn();
		const { user } = renderReact(<Harness onActivate={onActivate} />);
		screen.getByTestId("target").focus();

		await user.keyboard("{Control>}{Enter}{/Control}");
		await user.keyboard("{Alt>}{Enter}{/Alt}");
		await user.keyboard("{Meta>}{Enter}{/Meta}");

		expect(onActivate).not.toHaveBeenCalled();
	});

	it("suppresses keyboard auto-repeat", () => {
		const onActivate = vi.fn();
		const { container } = renderReact(<Harness onActivate={onActivate} />);
		const el = container.querySelector('[data-testid="target"]')!;

		el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
		el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));
		el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));

		expect(onActivate).toHaveBeenCalledTimes(1);
	});

	it("returns an empty props object when onActivate is undefined", async () => {
		const { user } = renderReact(<Harness onActivate={undefined} />);

		const el = screen.getByTestId("target");
		expect(el).not.toHaveAttribute("tabindex");

		// Clicking a passive element never triggers activation.
		await user.click(el);
		// (No handler to assert on — the test here is that nothing crashes.)
	});
});
