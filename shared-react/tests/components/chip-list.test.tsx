import { screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChipList } from "../../src/components/chip-list";
import { renderReact, type RenderReactResult } from "../helpers/render-react";

const PREFIX = "prisma-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

function ControlledList({ initial, onCommit }: { initial: string[]; onCommit?: (v: string[]) => void }) {
	const [value, setValue] = useState(initial);
	return (
		<ChipList
			value={value}
			onChange={(next) => {
				setValue(next);
				onCommit?.(next);
			}}
		/>
	);
}

describe("ChipList", () => {
	it("renders one Chip per value", () => {
		renderInTheme(<ChipList value={["a", "b", "c"]} onChange={vi.fn()} />);

		expect(screen.getByText("a")).toBeInTheDocument();
		expect(screen.getByText("b")).toBeInTheDocument();
		expect(screen.getByText("c")).toBeInTheDocument();
	});

	it("renders the default empty hint when value is empty", () => {
		renderInTheme(<ChipList value={[]} onChange={vi.fn()} />);
		expect(screen.getByText("No items")).toBeInTheDocument();
	});

	it("renders a custom empty hint", () => {
		renderInTheme(<ChipList value={[]} onChange={vi.fn()} emptyText="Nothing tagged" />);
		expect(screen.getByText("Nothing tagged")).toBeInTheDocument();
	});

	it("calls onChange with the value removed when a chip's ✕ is clicked", async () => {
		const onCommit = vi.fn();
		const { user } = renderInTheme(<ControlledList initial={["a", "b", "c"]} onCommit={onCommit} />);

		await user.click(screen.getByRole("button", { name: "Remove b" }));

		expect(onCommit).toHaveBeenCalledExactlyOnceWith(["a", "c"]);
		expect(screen.queryByText("b")).toBeNull();
	});

	it("transforms display names via getDisplayName without changing the canonical value", async () => {
		const onCommit = vi.fn();
		const { user } = renderInTheme(
			<ChipList value={["alpha"]} onChange={onCommit} getDisplayName={(v) => v.toUpperCase()} />
		);

		expect(screen.getByText("ALPHA")).toBeInTheDocument();
		// Remove button's accessible label uses the display name too
		await user.click(screen.getByRole("button", { name: "Remove ALPHA" }));
		expect(onCommit).toHaveBeenCalledExactlyOnceWith([]);
	});

	it("renders a tooltip via getTooltip", () => {
		renderInTheme(<ChipList value={["alpha"]} onChange={vi.fn()} getTooltip={(v) => `Tooltip for ${v}`} />);

		expect(screen.getByText("alpha")).toHaveAttribute("title", "Tooltip for alpha");
	});

	it("renders a per-chip prefix slot via renderPrefix", () => {
		const { container } = renderInTheme(
			<ChipList
				value={["alpha", "beta"]}
				onChange={vi.fn()}
				renderPrefix={(v) => <span data-testid={`dot-${v}`}>•</span>}
			/>
		);

		expect(within(container).getByTestId("dot-alpha")).toBeInTheDocument();
		expect(within(container).getByTestId("dot-beta")).toBeInTheDocument();
	});

	it("invokes onItemClick with the clicked chip's value", async () => {
		const onItemClick = vi.fn();
		const { user } = renderInTheme(<ChipList value={["alpha", "beta"]} onChange={vi.fn()} onItemClick={onItemClick} />);

		await user.click(screen.getByRole("button", { name: "beta" }));

		expect(onItemClick).toHaveBeenCalledExactlyOnceWith("beta");
	});
});
