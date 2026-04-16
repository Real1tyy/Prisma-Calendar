import type * as ObsidianMockModule from "@real1ty-obsidian-plugins/testing";
import { describe, expect, it, vi } from "vitest";

import { ObsidianIcon } from "../../src/components/obsidian-icon";
import { renderReact } from "../helpers/render-react";

vi.mock("obsidian", async () => {
	const actual = await vi.importActual<typeof ObsidianMockModule>("@real1ty-obsidian-plugins/testing");
	return {
		...actual,
		setIcon: vi.fn((el: HTMLElement, icon: string) => {
			el.setAttribute("data-icon", icon);
		}),
	};
});

const { setIcon } = await import("obsidian");

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
