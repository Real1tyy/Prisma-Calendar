import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "../../../src/primitives/atoms/chip";
import { renderReact, type RenderReactResult } from "../../helpers/render-react";

const PREFIX = "prisma-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

describe("Chip", () => {
	it("renders `value` as the label when `label` is omitted", () => {
		renderInTheme(<Chip value="alpha" />);
		expect(screen.getByText("alpha")).toBeInTheDocument();
	});

	it("prefers an explicit `label` over `value`", () => {
		renderInTheme(<Chip value="alpha" label="Alpha ✨" />);
		expect(screen.getByText("Alpha ✨")).toBeInTheDocument();
	});

	it("renders the tooltip as the `title` attribute", () => {
		renderInTheme(<Chip value="alpha" tooltip="Alpha category" />);
		expect(screen.getByText("alpha")).toHaveAttribute("title", "Alpha category");
	});

	it("renders the prefix slot before the label", () => {
		renderInTheme(<Chip value="alpha" prefix={<span data-testid="dot">•</span>} />);
		expect(screen.getByTestId("dot")).toBeInTheDocument();
	});

	it("invokes onClick with the value on label click", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(<Chip value="alpha" onClick={onClick} />);

		await user.click(screen.getByRole("button", { name: "alpha" }));

		expect(onClick).toHaveBeenCalledExactlyOnceWith("alpha");
	});

	it("invokes onClick on Enter / Space keypress when focused", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(<Chip value="alpha" onClick={onClick} />);
		const label = screen.getByRole("button", { name: "alpha" });
		label.focus();

		await user.keyboard("{Enter}");
		await user.keyboard(" ");

		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("omits the remove button when `onRemove` is not provided", () => {
		renderInTheme(<Chip value="alpha" />);
		expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
	});

	it("invokes onRemove when the ✕ is clicked", async () => {
		const onRemove = vi.fn();
		const { user } = renderInTheme(<Chip value="alpha" onRemove={onRemove} />);

		await user.click(screen.getByRole("button", { name: "Remove alpha" }));

		expect(onRemove).toHaveBeenCalledExactlyOnceWith("alpha");
	});

	it("stops propagation so remove does not trigger the label's onClick", async () => {
		const onClick = vi.fn();
		const onRemove = vi.fn();
		const { user } = renderInTheme(<Chip value="alpha" onClick={onClick} onRemove={onRemove} />);

		await user.click(screen.getByRole("button", { name: "Remove alpha" }));

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
	});
});
