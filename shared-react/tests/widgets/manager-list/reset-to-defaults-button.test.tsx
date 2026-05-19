import { screen } from "@testing-library/react";
import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { ResetToDefaultsButton } from "../../../src/widgets/manager-list/reset-to-defaults-button";
import { renderReact } from "../../helpers/render-react";

const openConfirmationMock = vi.fn();
vi.mock("../../../src/modals/confirmation-modal", () => ({
	openConfirmation: (...args: unknown[]) => openConfirmationMock(...args),
}));

const FAKE_APP = {} as unknown as App;
const PREFIX = "test-";

function setup(overrides: { onReset?: () => void; testId?: string } = {}) {
	const onReset = overrides.onReset ?? vi.fn();
	const ui = (
		<ResetToDefaultsButton
			app={FAKE_APP}
			cssPrefix={PREFIX}
			onReset={onReset}
			testId={overrides.testId ?? `${PREFIX}reset`}
		/>
	);
	return { onReset, ...renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX }) };
}

describe("ResetToDefaultsButton", () => {
	it("renders with the default label and a destructive style", () => {
		setup();

		const btn = screen.getByTestId(`${PREFIX}reset`);
		expect(btn).toHaveTextContent("Reset to defaults");
		expect(btn).toHaveClass("mod-warning");
	});

	it("opens a confirmation modal and calls onReset only after the user confirms", async () => {
		openConfirmationMock.mockReset().mockResolvedValueOnce({ extras: undefined });
		const { onReset, user } = setup();

		await user.click(screen.getByTestId(`${PREFIX}reset`));

		expect(openConfirmationMock).toHaveBeenCalledOnce();
		const [, options] = openConfirmationMock.mock.calls[0];
		expect(options).toMatchObject({
			destructive: true,
			confirmLabel: "Reset",
			cancelLabel: "Cancel",
			cssPrefix: PREFIX,
		});
		expect(onReset).toHaveBeenCalledOnce();
	});

	it("does not call onReset when the confirmation is cancelled", async () => {
		openConfirmationMock.mockReset().mockResolvedValueOnce(null);
		const { onReset, user } = setup();

		await user.click(screen.getByTestId(`${PREFIX}reset`));

		expect(openConfirmationMock).toHaveBeenCalledOnce();
		expect(onReset).not.toHaveBeenCalled();
	});

	it("forwards a custom confirmMessage and label to the confirmation modal", async () => {
		openConfirmationMock.mockReset().mockResolvedValueOnce({ extras: undefined });
		const onReset = vi.fn();
		const { user } = renderReact(
			<ResetToDefaultsButton
				app={FAKE_APP}
				cssPrefix={PREFIX}
				onReset={onReset}
				testId={`${PREFIX}reset`}
				label="Reset tabs"
				confirmTitle="Reset tabs?"
				confirmMessage="Restore the default tab order."
			/>,
			undefined,
			undefined,
			{ cssPrefix: PREFIX, testIdPrefix: PREFIX }
		);

		expect(screen.getByTestId(`${PREFIX}reset`)).toHaveTextContent("Reset tabs");

		await user.click(screen.getByTestId(`${PREFIX}reset`));

		const [, options] = openConfirmationMock.mock.calls[0];
		expect(options.title).toBe("Reset tabs?");
		expect(options.message).toBe("Restore the default tab order.");
	});
});
