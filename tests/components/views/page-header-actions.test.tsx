import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { PageHeaderActions, type PageHeaderActionsProps } from "../../../src/react/views/page-header-actions";
import { createMockApp, renderWithContexts } from "../../fixtures/react-view-fixtures";

vi.mock("@real1ty-obsidian-plugins-react", async (importOriginal) => {
	const actual: Record<string, unknown> = await importOriginal();
	return {
		...actual,
		ObsidianIcon: ({ icon }: { icon: string }) => createElement("span", { "data-icon": icon }),
	};
});

function setup(props: PageHeaderActionsProps = {}) {
	const app = createMockApp();
	const user = userEvent.setup();
	const result = renderWithContexts(<PageHeaderActions {...props} />, { app });
	return { ...result, app, user };
}

describe("PageHeaderActions", () => {
	it("renders the container even on default action set", () => {
		setup();
		expect(screen.getByTestId("prisma-page-header-actions")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-toolbar-undo")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-toolbar-redo")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-toolbar-refresh")).toBeInTheDocument();
	});

	it("renders only specified visible actions", () => {
		setup({ visibleActionIds: ["undo", "redo"] });
		expect(screen.getByTestId("prisma-toolbar-undo")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-toolbar-redo")).toBeInTheDocument();
		expect(screen.queryByTestId("prisma-toolbar-refresh")).not.toBeInTheDocument();
	});

	it("executes command on click", async () => {
		const { app, user } = setup({ visibleActionIds: ["refresh"] });
		await user.click(screen.getByTestId("prisma-toolbar-refresh"));
		expect((app as any).commands.executeCommandById).toHaveBeenCalledWith("prisma-calendar:refresh-calendar");
	});

	it("sets aria-label on buttons", () => {
		setup({ visibleActionIds: ["undo"] });
		const button = screen.getByTestId("prisma-toolbar-undo");
		expect(button).toHaveAttribute("aria-label", "Undo");
	});
});
