import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PageHeaderActionBar } from "../../src/page-header/action-bar";
import { PageHeaderStore } from "../../src/page-header/store";
import type { HeaderActionDefinition } from "../../src/page-header/types";
import { renderReact } from "../helpers/render-react";

const PREFIX = "test-";

function makeActions(count = 3): HeaderActionDefinition[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `action-${i}`,
		label: `Action ${i}`,
		icon: `icon-${i}`,
		onAction: vi.fn(),
	}));
}

describe("PageHeaderActionBar", () => {
	it("renders one button per visible action", () => {
		const store = new PageHeaderStore(makeActions(3));
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		expect(screen.getByTestId(`${PREFIX}toolbar-action-0`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}toolbar-action-1`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}toolbar-action-2`)).toBeInTheDocument();
	});

	it("hides settings button when not editable", () => {
		const store = new PageHeaderStore(makeActions(3));
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		expect(screen.queryByTestId(`${PREFIX}page-header-manage`)).not.toBeInTheDocument();
	});

	it("renders settings button when editable + showSettingsButton", () => {
		const store = new PageHeaderStore(makeActions(3));
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={true}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		expect(screen.getByTestId(`${PREFIX}page-header-manage`)).toBeInTheDocument();
	});

	it("hides settings button when showSettingsButton is false", () => {
		const store = new PageHeaderStore(makeActions(3), { showSettingsButton: false });
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={true}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		expect(screen.queryByTestId(`${PREFIX}page-header-manage`)).not.toBeInTheDocument();
	});

	it("invokes onActionClick with the action id", async () => {
		const onActionClick = vi.fn();
		const store = new PageHeaderStore(makeActions(3));
		const { user } = renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={onActionClick}
				onSettingsClick={vi.fn()}
			/>
		);

		await user.click(screen.getByTestId(`${PREFIX}toolbar-action-1`));
		expect(onActionClick).toHaveBeenCalledWith("action-1");
	});

	it("invokes onSettingsClick when settings button is pressed", async () => {
		const onSettingsClick = vi.fn();
		const store = new PageHeaderStore(makeActions(3));
		const { user } = renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={true}
				onActionClick={vi.fn()}
				onSettingsClick={onSettingsClick}
			/>
		);

		await user.click(screen.getByTestId(`${PREFIX}page-header-manage`));
		expect(onSettingsClick).toHaveBeenCalledOnce();
	});

	it("re-renders when the store hides an action", () => {
		const store = new PageHeaderStore(makeActions(3));
		const { rerender } = renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		expect(screen.getByTestId(`${PREFIX}toolbar-action-0`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}toolbar-action-1`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}toolbar-action-2`)).toBeInTheDocument();

		act(() => {
			store.hideAction("action-0");
		});
		rerender(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);
		expect(screen.queryByTestId(`${PREFIX}toolbar-action-0`)).not.toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}toolbar-action-1`)).toBeInTheDocument();
	});

	it("applies rename, icon, and color overrides", () => {
		const store = new PageHeaderStore(makeActions(2), {
			renames: { "action-0": "Renamed" },
			iconOverrides: { "action-0": "star" },
			colorOverrides: { "action-0": "#ff0000" },
		});
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		const btn = screen.getByTestId(`${PREFIX}toolbar-action-0`);
		expect(btn).toHaveAttribute("aria-label", "Renamed");
		expect(btn).not.toHaveAttribute("title");
		expect(btn.style.color).toBe("rgb(255, 0, 0)");
	});

	it("ignores #000000 sentinel color override", () => {
		const store = new PageHeaderStore(makeActions(1), {
			colorOverrides: { "action-0": "#000000" },
		});
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		const btn = screen.getByTestId(`${PREFIX}toolbar-action-0`);
		expect(btn.style.color).toBe("");
	});

	it("always renders the overflow trigger", () => {
		const store = new PageHeaderStore(makeActions(3));
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={vi.fn()}
				onSettingsClick={vi.fn()}
			/>
		);

		expect(screen.getByTestId(`${PREFIX}page-header-overflow`)).toBeInTheDocument();
	});

	it("overflow trigger opens a menu of the trimmed actions and invokes onActionClick", () => {
		// jsdom never lays out, so the fit logic can't trim a button on its own here —
		// simulate it by stamping the overflow markers the live fit logic would set,
		// then drive the trigger.
		const onActionClick = vi.fn();
		const store = new PageHeaderStore(makeActions(3));
		renderReact(
			<PageHeaderActionBar
				store={store}
				cssPrefix={PREFIX}
				editable={false}
				onActionClick={onActionClick}
				onSettingsClick={vi.fn()}
			/>
		);

		const trigger = screen.getByTestId(`${PREFIX}page-header-overflow`);
		const container = trigger.closest('[role="toolbar"]') as HTMLElement;
		const trimmed = screen.getByTestId(`${PREFIX}toolbar-action-1`);
		trimmed.setAttribute("data-ph-overflow", "true");
		container.setAttribute("data-ph-overflow-active", "true");

		fireEvent.click(trigger);

		// Only the trimmed action is offered.
		expect(screen.queryByTestId(`${PREFIX}ctx-item-action-0`)).not.toBeInTheDocument();
		const item = screen.getByTestId(`${PREFIX}ctx-item-action-1`);

		fireEvent.click(item);
		expect(onActionClick).toHaveBeenCalledWith("action-1");
	});
});
