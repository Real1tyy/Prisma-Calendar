import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "../../src/components/chip";
import { renderReact } from "../helpers/render-react";

const PREFIX = "prisma-";

describe("Chip", () => {
	it("renders `value` as the label when `label` is omitted", () => {
		renderReact(<Chip value="alpha" cssPrefix={PREFIX} />);
		expect(screen.getByText("alpha")).toBeInTheDocument();
	});

	it("prefers an explicit `label` over `value`", () => {
		renderReact(<Chip value="alpha" label="Alpha ✨" cssPrefix={PREFIX} />);
		expect(screen.getByText("Alpha ✨")).toBeInTheDocument();
	});

	it("renders the tooltip as the `title` attribute", () => {
		renderReact(<Chip value="alpha" tooltip="Alpha category" cssPrefix={PREFIX} />);
		expect(screen.getByText("alpha")).toHaveAttribute("title", "Alpha category");
	});

	it("renders the prefix slot before the label", () => {
		renderReact(<Chip value="alpha" cssPrefix={PREFIX} prefix={<span data-testid="dot">•</span>} />);
		expect(screen.getByTestId("dot")).toBeInTheDocument();
	});

	it("invokes onClick with the value on label click", async () => {
		const onClick = vi.fn();
		const { user } = renderReact(<Chip value="alpha" cssPrefix={PREFIX} onClick={onClick} />);

		await user.click(screen.getByRole("button", { name: "alpha" }));

		expect(onClick).toHaveBeenCalledExactlyOnceWith("alpha");
	});

	it("invokes onClick on Enter / Space keypress when focused", async () => {
		const onClick = vi.fn();
		const { user } = renderReact(<Chip value="alpha" cssPrefix={PREFIX} onClick={onClick} />);
		const label = screen.getByRole("button", { name: "alpha" });
		label.focus();

		await user.keyboard("{Enter}");
		await user.keyboard(" ");

		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("omits the remove button when `onRemove` is not provided", () => {
		renderReact(<Chip value="alpha" cssPrefix={PREFIX} />);
		expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
	});

	it("invokes onRemove when the ✕ is clicked", async () => {
		const onRemove = vi.fn();
		const { user } = renderReact(<Chip value="alpha" cssPrefix={PREFIX} onRemove={onRemove} />);

		await user.click(screen.getByRole("button", { name: "Remove alpha" }));

		expect(onRemove).toHaveBeenCalledExactlyOnceWith("alpha");
	});

	it("stops propagation so remove does not trigger the label's onClick", async () => {
		const onClick = vi.fn();
		const onRemove = vi.fn();
		const { user } = renderReact(<Chip value="alpha" cssPrefix={PREFIX} onClick={onClick} onRemove={onRemove} />);

		await user.click(screen.getByRole("button", { name: "Remove alpha" }));

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(onClick).not.toHaveBeenCalled();
	});
});
