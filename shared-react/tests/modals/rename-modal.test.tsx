import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RenameModalContent } from "../../src/modals/rename-modal";
import { renderReact } from "../helpers/render-react";

const PREFIX = "test-";

describe("RenameModalContent", () => {
	const defaultProps = {
		initialValue: "My Tab",
		testIdPrefix: PREFIX,
		onSubmit: vi.fn(),
		onCancel: vi.fn(),
	};

	it("renders with initial value in the input", () => {
		renderReact(<RenameModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}rename-input`)).toHaveValue("My Tab");
	});

	it("fires onSubmit with trimmed value when Save clicked", async () => {
		const onSubmit = vi.fn();
		const { user } = renderReact(<RenameModalContent {...defaultProps} onSubmit={onSubmit} />);

		await user.clear(screen.getByTestId(`${PREFIX}rename-input`));
		await user.type(screen.getByTestId(`${PREFIX}rename-input`), "New Name");
		await user.click(screen.getByTestId(`${PREFIX}rename-submit`));

		expect(onSubmit).toHaveBeenCalledWith("New Name");
	});

	it("fires onSubmit when Enter is pressed", async () => {
		const onSubmit = vi.fn();
		const { user } = renderReact(<RenameModalContent {...defaultProps} onSubmit={onSubmit} />);

		await user.clear(screen.getByTestId(`${PREFIX}rename-input`));
		await user.type(screen.getByTestId(`${PREFIX}rename-input`), "Enter Name{Enter}");

		expect(onSubmit).toHaveBeenCalledWith("Enter Name");
	});

	it("does not submit empty value", async () => {
		const onSubmit = vi.fn();
		const { user } = renderReact(<RenameModalContent {...defaultProps} onSubmit={onSubmit} />);

		await user.clear(screen.getByTestId(`${PREFIX}rename-input`));
		await user.click(screen.getByTestId(`${PREFIX}rename-submit`));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("does not submit when validation pattern fails", async () => {
		const onSubmit = vi.fn();
		const { user } = renderReact(
			<RenameModalContent {...defaultProps} initialValue="" onSubmit={onSubmit} validationPattern={/^[a-z]+$/} />
		);

		await user.type(screen.getByTestId(`${PREFIX}rename-input`), "ABC123");
		await user.click(screen.getByTestId(`${PREFIX}rename-submit`));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("fires onCancel when Cancel clicked", async () => {
		const onCancel = vi.fn();
		const { user } = renderReact(<RenameModalContent {...defaultProps} onCancel={onCancel} />);

		await user.click(screen.getByTestId(`${PREFIX}rename-cancel`));

		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("has the expected testid on the container", () => {
		renderReact(<RenameModalContent {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}rename-modal`)).toBeInTheDocument();
	});
});
