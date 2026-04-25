import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FrontmatterPropagationModalProps } from "../../src/modals/frontmatter-propagation-modal";
import { FrontmatterPropagationModalContent } from "../../src/modals/frontmatter-propagation-modal";
import { renderReact } from "../helpers/render-react";

const PREFIX = "test-";

function makeDiff(overrides: Partial<FrontmatterPropagationModalProps["diff"]> = {}) {
	return {
		added: overrides.added ?? [],
		modified: overrides.modified ?? [],
		deleted: overrides.deleted ?? [],
	};
}

const defaultProps: FrontmatterPropagationModalProps = {
	sourceLabel: "Weekly Review",
	diff: makeDiff(),
	targetCount: 5,
	testIdPrefix: PREFIX,
	onConfirm: vi.fn(),
	onCancel: vi.fn(),
};

describe("FrontmatterPropagationModalContent", () => {
	it("renders source label and target count in default description", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} />);

		expect(screen.getByText(/Weekly Review/)).toBeInTheDocument();
		expect(screen.getByText(/5 targets/)).toBeInTheDocument();
	});

	it("uses singular 'target' when count is 1", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} targetCount={1} />);

		expect(screen.getByText(/1 target\?/)).toBeInTheDocument();
	});

	it("renders custom description when provided", () => {
		renderReact(
			<FrontmatterPropagationModalContent {...defaultProps} description="Apply template changes to all linked notes?" />
		);

		expect(screen.getByText("Apply template changes to all linked notes?")).toBeInTheDocument();
	});

	it("renders added diff section with items", () => {
		const diff = makeDiff({
			added: [{ changeType: "added", key: "status", newValue: "done" }],
		});
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} diff={diff} />);

		expect(screen.getByText("Added properties:")).toBeInTheDocument();
		expect(screen.getByText(/status/)).toBeInTheDocument();
	});

	it("renders modified diff section with items", () => {
		const diff = makeDiff({
			modified: [{ changeType: "modified", key: "priority", oldValue: "low", newValue: "high" }],
		});
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} diff={diff} />);

		expect(screen.getByText("Modified properties:")).toBeInTheDocument();
		expect(screen.getByText(/priority/)).toBeInTheDocument();
	});

	it("renders deleted diff section with items", () => {
		const diff = makeDiff({
			deleted: [{ changeType: "deleted", key: "tags", oldValue: ["work"] }],
		});
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} diff={diff} />);

		expect(screen.getByText("Deleted properties:")).toBeInTheDocument();
		expect(screen.getByText(/tags/)).toBeInTheDocument();
	});

	it("hides empty diff sections", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} diff={makeDiff()} />);

		expect(screen.queryByText("Added properties:")).not.toBeInTheDocument();
		expect(screen.queryByText("Modified properties:")).not.toBeInTheDocument();
		expect(screen.queryByText("Deleted properties:")).not.toBeInTheDocument();
	});

	it("renders all three sections when all have changes", () => {
		const diff = makeDiff({
			added: [{ changeType: "added", key: "a", newValue: 1 }],
			modified: [{ changeType: "modified", key: "b", oldValue: 1, newValue: 2 }],
			deleted: [{ changeType: "deleted", key: "c", oldValue: 3 }],
		});
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} diff={diff} />);

		expect(screen.getByText("Added properties:")).toBeInTheDocument();
		expect(screen.getByText("Modified properties:")).toBeInTheDocument();
		expect(screen.getByText("Deleted properties:")).toBeInTheDocument();
	});

	it("fires onConfirm when confirm button clicked", async () => {
		const onConfirm = vi.fn();
		const { user } = renderReact(<FrontmatterPropagationModalContent {...defaultProps} onConfirm={onConfirm} />);

		await user.click(screen.getByTestId(`${PREFIX}frontmatter-propagation-confirm`));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("fires onCancel when cancel button clicked", async () => {
		const onCancel = vi.fn();
		const { user } = renderReact(<FrontmatterPropagationModalContent {...defaultProps} onCancel={onCancel} />);

		await user.click(screen.getByTestId(`${PREFIX}frontmatter-propagation-cancel`));
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("confirm button has primary variant", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}frontmatter-propagation-confirm`)).toHaveClass("mod-cta");
	});

	it("uses testIdPrefix for container", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}frontmatter-propagation-modal`)).toBeInTheDocument();
	});

	it("uses cssPrefix for diff section class names", () => {
		const diff = makeDiff({
			added: [{ changeType: "added", key: "x", newValue: "y" }],
		});
		const { container } = renderReact(
			<FrontmatterPropagationModalContent {...defaultProps} diff={diff} cssPrefix="custom" />
		);

		expect(container.querySelector(".custom-frontmatter-changes")).toBeInTheDocument();
		expect(container.querySelector(".custom-change-added")).toBeInTheDocument();
	});

	it("confirm button says 'Yes, propagate'", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}frontmatter-propagation-confirm`)).toHaveTextContent("Yes, propagate");
	});

	it("cancel button says 'No, skip'", () => {
		renderReact(<FrontmatterPropagationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}frontmatter-propagation-cancel`)).toHaveTextContent("No, skip");
	});
});
