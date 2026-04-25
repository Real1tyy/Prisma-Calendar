import { act, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { ProgressContent } from "../../src/modals/progress-modal";
import { renderReact } from "../helpers/render-react";

const PREFIX = "test-";

type StateRef = RefObject<{
	update: (current: number, detail?: string) => void;
	complete: (summaryLines: string[]) => void;
	error: (message: string) => void;
} | null>;

function createStateRef(): StateRef {
	return { current: null };
}

function renderProgress(overrides: Partial<React.ComponentProps<typeof ProgressContent>> = {}) {
	const stateRef = overrides.stateRef ?? createStateRef();
	const close = overrides.close ?? vi.fn();

	const result = renderReact(
		<ProgressContent
			cssPrefix={PREFIX}
			title="Processing..."
			total={10}
			statusTemplate="Processing {current} of {total}..."
			initialDetails="Starting..."
			stateRef={stateRef}
			close={close}
			successCloseDelay={2000}
			errorCloseDelay={3000}
			{...overrides}
		/>
	);

	return { ...result, stateRef, close };
}

describe("ProgressContent", () => {
	it("renders title", () => {
		renderProgress();

		expect(screen.getByText("Processing...")).toBeInTheDocument();
	});

	it("renders initial status text", () => {
		renderProgress();

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Processing 0 of 10...");
	});

	it("renders initial details", () => {
		renderProgress();

		expect(screen.getByTestId(`${PREFIX}progress-details`)).toHaveTextContent("Starting...");
	});

	it("renders progress bar at 0%", () => {
		renderProgress();

		const bar = screen.getByTestId(`${PREFIX}progress-bar`);
		expect(bar).toHaveStyle({ width: "0%" });
	});

	it("updates progress via stateRef.update", () => {
		const { stateRef } = renderProgress();

		act(() => stateRef.current?.update(5, "Halfway there"));

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Processing 5 of 10...");
		expect(screen.getByTestId(`${PREFIX}progress-details`)).toHaveTextContent("Halfway there");
		expect(screen.getByTestId(`${PREFIX}progress-bar`)).toHaveStyle({ width: "50%" });
	});

	it("clamps progress to total", () => {
		const { stateRef } = renderProgress();

		act(() => stateRef.current?.update(99));

		expect(screen.getByTestId(`${PREFIX}progress-bar`)).toHaveStyle({ width: "100%" });
	});

	it("preserves previous detail when update called without detail", () => {
		const { stateRef } = renderProgress();

		act(() => stateRef.current?.update(3, "Step 3"));
		act(() => stateRef.current?.update(5));

		expect(screen.getByTestId(`${PREFIX}progress-details`)).toHaveTextContent("Step 3");
	});

	it("shows complete state via stateRef.complete", async () => {
		vi.useFakeTimers();
		const close = vi.fn();
		const { stateRef } = renderProgress({ close });

		act(() => stateRef.current?.complete(["Done", "10 items processed"]));

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Processing complete");
		expect(screen.getByTestId(`${PREFIX}progress-details`)).toHaveTextContent("Done • 10 items processed");
		expect(screen.getByTestId(`${PREFIX}progress-bar`)).toHaveStyle({ width: "100%" });
		expect(screen.getByTestId(`${PREFIX}progress-bar`)).toHaveClass(`${PREFIX}progress-complete`);

		expect(close).not.toHaveBeenCalled();
		await act(() => vi.advanceTimersByTime(2000));
		expect(close).toHaveBeenCalledOnce();

		vi.useRealTimers();
	});

	it("shows error state via stateRef.error", async () => {
		vi.useFakeTimers();
		const close = vi.fn();
		const { stateRef } = renderProgress({ close });

		act(() => stateRef.current?.error("Network failure"));

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Processing failed");
		expect(screen.getByTestId(`${PREFIX}progress-details`)).toHaveTextContent("Network failure");
		expect(screen.getByTestId(`${PREFIX}progress-bar`)).toHaveClass(`${PREFIX}progress-error`);

		expect(close).not.toHaveBeenCalled();
		await act(() => vi.advanceTimersByTime(3000));
		expect(close).toHaveBeenCalledOnce();

		vi.useRealTimers();
	});

	it("ignores updates after complete", () => {
		const { stateRef } = renderProgress();

		act(() => stateRef.current?.complete(["Done"]));
		act(() => stateRef.current?.update(3, "Should not appear"));

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Processing complete");
	});

	it("ignores updates after error", () => {
		const { stateRef } = renderProgress();

		act(() => stateRef.current?.error("Failed"));
		act(() => stateRef.current?.update(3, "Should not appear"));

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Processing failed");
	});

	it("uses custom status template", () => {
		renderProgress({ statusTemplate: "Step {current}/{total}" });

		expect(screen.getByTestId(`${PREFIX}progress-status`)).toHaveTextContent("Step 0/10");
	});

	it("uses custom initial details", () => {
		renderProgress({ initialDetails: "Warming up..." });

		expect(screen.getByTestId(`${PREFIX}progress-details`)).toHaveTextContent("Warming up...");
	});

	it("uses cssPrefix for testIds", () => {
		renderProgress({ cssPrefix: "custom-" });

		expect(screen.getByTestId("custom-progress-modal")).toBeInTheDocument();
		expect(screen.getByTestId("custom-progress-status")).toBeInTheDocument();
		expect(screen.getByTestId("custom-progress-bar")).toBeInTheDocument();
		expect(screen.getByTestId("custom-progress-details")).toBeInTheDocument();
	});

	it("handles total of 0 without division error", () => {
		renderProgress({ total: 0 });

		expect(screen.getByTestId(`${PREFIX}progress-bar`)).toHaveStyle({ width: "0%" });
	});
});
