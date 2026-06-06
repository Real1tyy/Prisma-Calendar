import { setIcon } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { ObsidianIcon } from "../../../src/primitives/atoms/obsidian-icon";
import { renderReact } from "../../helpers/render-react";

describe("ObsidianIcon", () => {
	it("invokes setIcon on mount with the given icon id", () => {
		const { container } = renderReact(<ObsidianIcon icon="calendar" />);
		const span = container.firstElementChild as HTMLElement;

		expect(setIcon).toHaveBeenCalledWith(span, "calendar");
		expect(span).toHaveAttribute("data-icon", "calendar");
	});

	it("re-invokes setIcon when the icon prop changes", () => {
		vi.mocked(setIcon).mockClear();
		const { rerender, container } = renderReact(<ObsidianIcon icon="calendar" />);

		rerender(<ObsidianIcon icon="search" />);

		const span = container.firstElementChild as HTMLElement;
		expect(setIcon).toHaveBeenLastCalledWith(span, "search");
	});

	it("applies the className prop to the span", () => {
		const { container } = renderReact(<ObsidianIcon icon="calendar" className="my-icon" />);
		expect(container.firstElementChild).toHaveClass("my-icon");
	});
});
