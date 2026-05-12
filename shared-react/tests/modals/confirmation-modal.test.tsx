import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationModalContent } from "../../src/modals/confirmation-modal";
import { renderReact, type RenderReactResult } from "../helpers/render-react";

const PREFIX = "test-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

describe("ConfirmationModalContent", () => {
	const defaultProps = {
		title: "Delete event?",
		message: "This cannot be undone.",
		testIdPrefix: PREFIX,
		onConfirm: vi.fn(),
		onCancel: vi.fn(),
	};

	it("renders with message and default button labels", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}confirmation-modal-confirm`)).toHaveTextContent("Confirm");
		expect(screen.getByTestId(`${PREFIX}confirmation-modal-cancel`)).toHaveTextContent("Cancel");
	});

	it("uses custom button labels", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} confirmLabel="Delete" cancelLabel="Keep" />);

		expect(screen.getByTestId(`${PREFIX}confirmation-modal-confirm`)).toHaveTextContent("Delete");
		expect(screen.getByTestId(`${PREFIX}confirmation-modal-cancel`)).toHaveTextContent("Keep");
	});

	it("fires onConfirm when confirm button clicked", async () => {
		const onConfirm = vi.fn();
		const { user } = renderInTheme(<ConfirmationModalContent {...defaultProps} onConfirm={onConfirm} />);

		await user.click(screen.getByTestId(`${PREFIX}confirmation-modal-confirm`));

		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("fires onCancel when cancel button clicked", async () => {
		const onCancel = vi.fn();
		const { user } = renderInTheme(<ConfirmationModalContent {...defaultProps} onCancel={onCancel} />);

		await user.click(screen.getByTestId(`${PREFIX}confirmation-modal-cancel`));

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("renders confirm button with warning variant when destructive", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} destructive />);

		expect(screen.getByTestId(`${PREFIX}confirmation-modal-confirm`)).toHaveClass("mod-warning");
	});

	it("renders confirm button with primary variant by default", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}confirmation-modal-confirm`)).toHaveClass("mod-cta");
	});

	it("does not render message when not provided", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} message={undefined} />);

		expect(screen.queryByText("This cannot be undone.")).not.toBeInTheDocument();
	});

	it("has the expected testid on the container", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}confirmation-modal`)).toBeInTheDocument();
	});

	it("renders extras slot between message and footer", () => {
		renderInTheme(
			<ConfirmationModalContent {...defaultProps} extras={<div data-testid="confirm-extra-slot">extra content</div>} />
		);

		expect(screen.getByTestId("confirm-extra-slot")).toBeInTheDocument();
	});

	it("extras slot is omitted when not provided", () => {
		renderInTheme(<ConfirmationModalContent {...defaultProps} />);

		expect(screen.queryByTestId("confirm-extra-slot")).not.toBeInTheDocument();
	});

	it("ignores repeated confirm clicks (double-click guard)", async () => {
		const onConfirm = vi.fn();
		const { user } = renderInTheme(<ConfirmationModalContent {...defaultProps} onConfirm={onConfirm} />);

		const button = screen.getByTestId(`${PREFIX}confirmation-modal-confirm`);
		await user.click(button);
		await user.click(button);
		await user.click(button);

		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("ignores cancel after confirm (settled guard)", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		const { user } = renderInTheme(
			<ConfirmationModalContent {...defaultProps} onConfirm={onConfirm} onCancel={onCancel} />
		);

		await user.click(screen.getByTestId(`${PREFIX}confirmation-modal-confirm`));
		await user.click(screen.getByTestId(`${PREFIX}confirmation-modal-cancel`));

		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onCancel).not.toHaveBeenCalled();
	});
});
