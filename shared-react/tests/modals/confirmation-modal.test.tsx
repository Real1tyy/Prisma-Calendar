import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationModalContent } from "../../src/modals/confirmation-modal";
import { renderReact } from "../helpers/render-react";

const PREFIX = "test-";

describe("ConfirmationModalContent", () => {
	const defaultProps = {
		title: "Delete event?",
		message: "This cannot be undone.",
		testIdPrefix: PREFIX,
		onConfirm: vi.fn(),
		onCancel: vi.fn(),
	};

	it("renders with message and default button labels", () => {
		renderReact(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}confirmation-confirm`)).toHaveTextContent("Confirm");
		expect(screen.getByTestId(`${PREFIX}confirmation-cancel`)).toHaveTextContent("Cancel");
	});

	it("uses custom button labels", () => {
		renderReact(<ConfirmationModalContent {...defaultProps} confirmLabel="Delete" cancelLabel="Keep" />);

		expect(screen.getByTestId(`${PREFIX}confirmation-confirm`)).toHaveTextContent("Delete");
		expect(screen.getByTestId(`${PREFIX}confirmation-cancel`)).toHaveTextContent("Keep");
	});

	it("fires onConfirm when confirm button clicked", async () => {
		const onConfirm = vi.fn();
		const { user } = renderReact(<ConfirmationModalContent {...defaultProps} onConfirm={onConfirm} />);

		await user.click(screen.getByTestId(`${PREFIX}confirmation-confirm`));

		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("fires onCancel when cancel button clicked", async () => {
		const onCancel = vi.fn();
		const { user } = renderReact(<ConfirmationModalContent {...defaultProps} onCancel={onCancel} />);

		await user.click(screen.getByTestId(`${PREFIX}confirmation-cancel`));

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("renders confirm button with warning variant when destructive", () => {
		renderReact(<ConfirmationModalContent {...defaultProps} destructive />);

		expect(screen.getByTestId(`${PREFIX}confirmation-confirm`)).toHaveClass("mod-warning");
	});

	it("renders confirm button with primary variant by default", () => {
		renderReact(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}confirmation-confirm`)).toHaveClass("mod-cta");
	});

	it("does not render message when not provided", () => {
		renderReact(<ConfirmationModalContent {...defaultProps} message={undefined} />);

		expect(screen.queryByText("This cannot be undone.")).not.toBeInTheDocument();
	});

	it("has the expected testid on the container", () => {
		renderReact(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}confirmation-modal`)).toBeInTheDocument();
	});
});
