import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu } from "../../src/menus";
import { renderReact } from "../helpers/render-react";

describe("ContextMenu.Root (composable)", () => {
	it("opens on right-click and renders content", async () => {
		const { user } = renderReact(
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<button type="button">Right click me</button>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<ContextMenu.Item onSelect={vi.fn()}>Action</ContextMenu.Item>
					<ContextMenu.Separator />
				</ContextMenu.Content>
			</ContextMenu.Root>
		);

		expect(screen.queryByRole("menu")).not.toBeInTheDocument();

		await user.pointer({ target: screen.getByText("Right click me"), keys: "[MouseRight]" });

		expect(screen.getByRole("menu")).toBeInTheDocument();
		expect(screen.getByText("Action")).toBeInTheDocument();
	});

	it("Item click fires onSelect and closes menu", async () => {
		const onSelect = vi.fn();
		const { user } = renderReact(
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<button type="button">Trigger</button>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<ContextMenu.Item onSelect={onSelect}>Action</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Root>
		);

		await user.pointer({ target: screen.getByText("Trigger"), keys: "[MouseRight]" });
		await user.click(screen.getByText("Action"));

		expect(onSelect).toHaveBeenCalledOnce();
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
	});

	it("disabled Item does not fire onSelect", async () => {
		const onSelect = vi.fn();
		const { user } = renderReact(
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<button type="button">Trigger</button>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<ContextMenu.Item onSelect={onSelect} disabled>
						Disabled Action
					</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Root>
		);

		await user.pointer({ target: screen.getByText("Trigger"), keys: "[MouseRight]" });
		await user.click(screen.getByText("Disabled Action"));

		expect(onSelect).not.toHaveBeenCalled();
	});

	it("disabled Item has is-disabled class", async () => {
		const { user } = renderReact(
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<button type="button">Trigger</button>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<ContextMenu.Item disabled>Disabled</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Root>
		);

		await user.pointer({ target: screen.getByText("Trigger"), keys: "[MouseRight]" });

		expect(screen.getByText("Disabled").closest("[role='menuitem']")).toHaveClass("is-disabled");
	});

	it("Separator renders with separator role", async () => {
		const { user } = renderReact(
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<button type="button">Trigger</button>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					<ContextMenu.Item>A</ContextMenu.Item>
					<ContextMenu.Separator />
					<ContextMenu.Item>B</ContextMenu.Item>
				</ContextMenu.Content>
			</ContextMenu.Root>
		);

		await user.pointer({ target: screen.getByText("Trigger"), keys: "[MouseRight]" });

		expect(screen.getByRole("separator")).toBeInTheDocument();
	});

	it("click outside closes menu", async () => {
		const { user } = renderReact(
			<>
				<div data-testid="outside">Outside</div>
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						<button type="button">Trigger</button>
					</ContextMenu.Trigger>
					<ContextMenu.Content>
						<ContextMenu.Item>Action</ContextMenu.Item>
					</ContextMenu.Content>
				</ContextMenu.Root>
			</>
		);

		await user.pointer({ target: screen.getByText("Trigger"), keys: "[MouseRight]" });
		expect(screen.getByRole("menu")).toBeInTheDocument();

		await user.click(screen.getByTestId("outside"));
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
	});
});
