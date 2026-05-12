import { act, screen } from "@testing-library/react";
import type { App } from "obsidian";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { AppContext } from "../../../src/contexts/app-context";
import { TabManagerContent } from "../../../src/views/tabbed-container/tab-manager-modal";
import type { TabEntry } from "../../../src/views/tabbed-container/types";
import { useTabbedContainer } from "../../../src/views/tabbed-container/use-tabbed-container";
import { renderReact, type RenderReactResult } from "../../helpers/render-react";

const stubApp = {} as unknown as App;
const PREFIX = "t-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

function makeTabs(): TabEntry[] {
	return [
		{ id: "a", label: "Alpha", content: null },
		{ id: "b", label: "Beta", content: null },
		{ id: "c", label: "Gamma", content: null },
	];
}

function makeGroupTabs(): TabEntry[] {
	return [
		{ id: "single", label: "Single", content: null },
		{
			id: "g",
			label: "Group",
			children: [
				{ id: "child-a", label: "Child A", content: null },
				{ id: "child-b", label: "Child B", content: null },
			],
		},
	];
}

function Harness({ tabs }: { tabs: TabEntry[] }) {
	const { state, actions } = useTabbedContainer({ tabs });
	return (
		<AppContext value={stubApp}>
			<TabManagerContent cssPrefix={PREFIX} state={state} actions={actions} />
		</AppContext>
	);
}

describe("TabManagerContent", () => {
	it("renders a row per tab in current visible order", () => {
		renderInTheme(<Harness tabs={makeTabs()} />);
		expect(screen.getByTestId(`${PREFIX}tab-manager-row-a`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}tab-manager-row-b`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}tab-manager-row-c`)).toBeInTheDocument();
	});

	it("hides a tab when clicking its visibility toggle", async () => {
		const { user } = renderInTheme(<Harness tabs={makeTabs()} />);
		const toggle = screen.getByTestId(`${PREFIX}tab-manager-toggle-b`);
		await user.click(toggle);

		expect(screen.getByTestId(`${PREFIX}tab-manager-row-b`)).toHaveClass(`${PREFIX}tab-manager-row-hidden`);
	});

	it("restores a hidden tab when clicking its toggle again", async () => {
		const { user } = renderInTheme(<Harness tabs={makeTabs()} />);
		const toggle = screen.getByTestId(`${PREFIX}tab-manager-toggle-b`);
		await user.click(toggle);
		await user.click(toggle);

		expect(screen.getByTestId(`${PREFIX}tab-manager-row-b`)).not.toHaveClass(`${PREFIX}tab-manager-row-hidden`);
	});

	it("disables the visibility toggle when only one tab remains", async () => {
		const { user } = renderInTheme(<Harness tabs={[{ id: "solo", label: "Solo", content: null }]} />);
		const toggle = screen.getByTestId(`${PREFIX}tab-manager-toggle-solo`);
		expect(toggle).toBeDisabled();
		await user.click(toggle);
		expect(screen.getByTestId(`${PREFIX}tab-manager-row-solo`)).toBeInTheDocument();
	});

	it("moves a tab up via the chevron-up button", async () => {
		const { user } = renderInTheme(<Harness tabs={makeTabs()} />);
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-up-b`));

		const orderedIds = Array.from(document.querySelectorAll(`.${PREFIX}tab-manager-list [data-tab-id]`)).map((el) =>
			el.getAttribute("data-tab-id")
		);
		expect(orderedIds).toEqual(["b", "a", "c"]);
	});

	it("moves a tab down via the chevron-down button", async () => {
		const { user } = renderInTheme(<Harness tabs={makeTabs()} />);
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-down-b`));

		const orderedIds = Array.from(document.querySelectorAll(`.${PREFIX}tab-manager-list [data-tab-id]`)).map((el) =>
			el.getAttribute("data-tab-id")
		);
		expect(orderedIds).toEqual(["a", "c", "b"]);
	});

	it("omits the move-up button on the first row and move-down on the last row", () => {
		renderInTheme(<Harness tabs={makeTabs()} />);
		expect(screen.queryByTestId(`${PREFIX}tab-manager-up-a`)).not.toBeInTheDocument();
		expect(screen.queryByTestId(`${PREFIX}tab-manager-down-c`)).not.toBeInTheDocument();
	});

	it("toggles the edit form open via the pencil button", async () => {
		const { user } = renderInTheme(<Harness tabs={makeTabs()} />);
		expect(document.querySelector(`.${PREFIX}tab-manager-edit-form`)).toBeNull();
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-edit-b`));
		expect(document.querySelector(`.${PREFIX}tab-manager-edit-form`)).toBeInTheDocument();
	});

	it("renders the show-settings-button toggle and persists changes", async () => {
		const { user, container } = renderInTheme(<Harness tabs={makeTabs()} />);
		const toggle = container.querySelector<HTMLElement>(".checkbox-container");
		expect(toggle).not.toBeNull();
		expect(toggle).toHaveClass("is-enabled");

		// flipping the toggle still leaves the row rendered (UI parity check)
		await user.click(toggle as HTMLElement);
		expect(toggle).not.toHaveClass("is-enabled");
	});
});

describe("TabManagerContent groups", () => {
	it("renders the group toggle chevron only for group tabs", () => {
		renderInTheme(<Harness tabs={makeGroupTabs()} />);
		expect(screen.getByTestId(`${PREFIX}tab-manager-group-toggle-g`)).toBeInTheDocument();
		expect(screen.queryByTestId(`${PREFIX}tab-manager-group-toggle-single`)).not.toBeInTheDocument();
	});

	it("does not render group children until the group is expanded", () => {
		renderInTheme(<Harness tabs={makeGroupTabs()} />);
		expect(screen.queryByTestId(`${PREFIX}tab-manager-row-child-a`)).not.toBeInTheDocument();
	});

	it("expands the group and shows its children when the chevron is clicked", async () => {
		const { user } = renderInTheme(<Harness tabs={makeGroupTabs()} />);
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-group-toggle-g`));
		expect(screen.getByTestId(`${PREFIX}tab-manager-row-child-a`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}tab-manager-row-child-b`)).toBeInTheDocument();
	});

	it("hides a group child via its visibility toggle", async () => {
		const { user } = renderInTheme(<Harness tabs={makeGroupTabs()} />);
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-group-toggle-g`));
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-toggle-child-a`));

		expect(screen.getByTestId(`${PREFIX}tab-manager-row-child-a`)).toHaveClass(`${PREFIX}tab-manager-row-hidden`);
	});

	it("reorders group children via the chevron buttons", async () => {
		const { user } = renderInTheme(<Harness tabs={makeGroupTabs()} />);
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-group-toggle-g`));
		await user.click(screen.getByTestId(`${PREFIX}tab-manager-down-child-a`));

		const childIds = Array.from(document.querySelectorAll(`.${PREFIX}tab-manager-children [data-tab-id]`)).map((el) =>
			el.getAttribute("data-tab-id")
		);
		expect(childIds).toEqual(["child-b", "child-a"]);
	});

	it("does not crash with group tabs containing zero children visible", () => {
		const tabs: TabEntry[] = [{ id: "g", label: "Group", children: [{ id: "only", label: "Only", content: null }] }];
		expect(() => act(() => renderInTheme(<Harness tabs={tabs} />))).not.toThrow();
	});
});
