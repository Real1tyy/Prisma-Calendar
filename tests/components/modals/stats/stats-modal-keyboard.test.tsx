import "@testing-library/jest-dom/vitest";

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatsModalContent } from "../../../../src/react/modals/stats/stats-modal";
import { createMockReactBundle, renderWithContexts } from "../../../fixtures/react-view-fixtures";

// Regression: the imperative IntervalStatsModal registered Left/Right (and
// Shift+Left/Right) arrow shortcuts via `Modal.scope`. The React port lost
// them because `showReactModal` doesn't expose a keymap scope — the
// shortcuts have to live on a window listener inside the modal content.
// Without these tests the regression slipped past pre-commit silently.

async function renderWeekly(initial: Date): Promise<HTMLElement> {
	const bundle = createMockReactBundle();
	renderWithContexts(<StatsModalContent bundle={bundle} range="weekly" initialDate={initial} />, { bundle });
	return await screen.findByTestId("prisma-stats-modal-period-label");
}

describe("StatsModalContent — keyboard navigation", () => {
	it("ArrowRight advances the weekly view by one week", async () => {
		const label = await renderWeekly(new Date(2026, 4, 14, 12, 0, 0));
		const before = label.textContent;

		fireEvent.keyDown(window, { key: "ArrowRight" });

		await screen.findByText((_text, node) => node === label && node.textContent !== before);
	});

	it("ArrowLeft retreats by one week", async () => {
		const label = await renderWeekly(new Date(2026, 4, 14, 12, 0, 0));
		const before = label.textContent;

		fireEvent.keyDown(window, { key: "ArrowLeft" });

		await screen.findByText((_text, node) => node === label && node.textContent !== before);
	});

	it("Shift+ArrowRight uses fast-nav (different from slow nav)", async () => {
		const label = await renderWeekly(new Date(2026, 4, 14, 12, 0, 0));

		fireEvent.keyDown(window, { key: "ArrowRight" });
		const afterSlow = await screen.findByText((_text, node) => node === label && node.textContent.length > 0);
		const slowText = afterSlow.textContent;

		fireEvent.keyDown(window, { key: "ArrowLeft" });
		fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });

		await screen.findByText((_text, node) => node === label && node.textContent !== slowText);
	});

	it("does not navigate when focus is inside an INPUT (does not hijack typing)", async () => {
		const label = await renderWeekly(new Date(2026, 4, 14, 12, 0, 0));
		const before = label.textContent;

		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		try {
			fireEvent.keyDown(input, { key: "ArrowRight" });
			fireEvent.keyDown(input, { key: "ArrowLeft" });
		} finally {
			input.remove();
		}

		expect(label.textContent).toBe(before);
	});

	it("alltime range has no arrow handler (no navigable header)", async () => {
		const bundle = createMockReactBundle();
		renderWithContexts(<StatsModalContent bundle={bundle} range="alltime" />, { bundle });

		// alltime renders without prisma-stats-modal-period-label; ArrowRight must be a no-op.
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(screen.queryByTestId("prisma-stats-modal-period-label")).toBeNull();
	});
});

describe("StatsModalContent — button navigation", () => {
	it("Next button advances the weekly view (label changes)", async () => {
		const label = await renderWeekly(new Date(2026, 4, 14, 12, 0, 0));
		const before = label.textContent;

		fireEvent.click(screen.getByTestId("prisma-stats-modal-next"));

		await screen.findByText((_text, node) => node === label && node.textContent !== before);
	});

	it("Today button changes the label away from a navigated-to state", async () => {
		// Anchor far in the past so `initial`, `initial + 1 week`, and today's week
		// are all distinct — keeps the assertion stable regardless of when the
		// suite runs (today's date drifts; the fixture must not).
		const label = await renderWeekly(new Date(2020, 0, 1, 12, 0, 0));
		const initial = label.textContent;

		fireEvent.click(screen.getByTestId("prisma-stats-modal-next"));
		const afterNext = await screen.findByText((_text, node) => node === label && node.textContent !== initial);
		const afterNextText = afterNext.textContent;

		fireEvent.click(screen.getByTestId("prisma-stats-modal-today"));
		await screen.findByText((_text, node) => node === label && node.textContent !== afterNextText);
	});

	it("Prev button retreats the weekly view (label changes)", async () => {
		const label = await renderWeekly(new Date(2026, 4, 14, 12, 0, 0));
		const before = label.textContent;

		fireEvent.click(screen.getByTestId("prisma-stats-modal-prev"));

		await screen.findByText((_text, node) => node === label && node.textContent !== before);
	});
});
