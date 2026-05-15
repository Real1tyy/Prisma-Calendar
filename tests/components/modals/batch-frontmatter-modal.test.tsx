import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BatchFrontmatterForm } from "../../../src/react/modals/batch/batch-frontmatter-modal";

vi.mock("../../../src/utils/events/frontmatter", () => ({
	getAllFrontmatterProperties: () => new Map<string, string>(),
}));

function setup(onSubmit = vi.fn(), onCancel = vi.fn()) {
	const user = userEvent.setup();
	const result = render(
		<BatchFrontmatterForm
			app={{} as never}
			settings={{} as never}
			selectedEvents={[]}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
	return { onSubmit, onCancel, user, ...result };
}

describe("BatchFrontmatterForm", () => {
	it("renders heading and add button", () => {
		setup();
		expect(screen.getByText("Batch frontmatter management")).toBeDefined();
		expect(screen.getByTestId("prisma-batch-add-property")).toBeDefined();
	});

	it("starts with one empty property row", () => {
		setup();
		expect(screen.getAllByTestId("prisma-batch-property-row")).toHaveLength(1);
	});

	it("add button creates a new property row", async () => {
		const { user } = setup();
		await user.click(screen.getByTestId("prisma-batch-add-property"));
		expect(screen.getAllByTestId("prisma-batch-property-row")).toHaveLength(2);
	});

	it("cancel calls onCancel", async () => {
		const onCancel = vi.fn();
		const { user } = setup(vi.fn(), onCancel);
		await user.click(screen.getByTestId("prisma-form-cancel"));
		expect(onCancel).toHaveBeenCalled();
	});

	it("submit calls onSubmit with property map", async () => {
		const onSubmit = vi.fn();
		const { user } = setup(onSubmit);

		await user.type(screen.getAllByTestId("prisma-batch-property-key")[0], "tags");
		await user.type(screen.getAllByTestId("prisma-batch-property-value")[0], "work");
		await user.click(screen.getByTestId("prisma-form-submit"));

		expect(onSubmit).toHaveBeenCalled();
		const submittedMap = onSubmit.mock.calls[0][0] as Map<string, string | null>;
		expect(submittedMap.get("tags")).toBe("work");
	});
});
