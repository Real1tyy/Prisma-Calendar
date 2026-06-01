import "@testing-library/jest-dom/vitest";

import { act, render, screen } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import { IndexingOverlay, INITIAL_INDEXING_TEXT, REINDEXING_TEXT } from "../../../src/react/views/indexing-overlay";

const OVERLAY_TESTID = "prisma-indexing-overlay";

function renderOverlay(indexingComplete$: BehaviorSubject<boolean>) {
	return render(<IndexingOverlay indexingComplete$={indexingComplete$} />);
}

describe("IndexingOverlay", () => {
	it("shows the spinner with the initial indexing label while a scan is in progress", () => {
		renderOverlay(new BehaviorSubject(false));

		const overlay = screen.getByTestId(OVERLAY_TESTID);
		expect(overlay).toBeInTheDocument();
		expect(overlay).toHaveTextContent(INITIAL_INDEXING_TEXT);
	});

	it("removes the overlay once indexing completes", () => {
		const indexingComplete$ = new BehaviorSubject(false);
		renderOverlay(indexingComplete$);

		act(() => indexingComplete$.next(true));

		expect(screen.queryByTestId(OVERLAY_TESTID)).not.toBeInTheDocument();
	});

	it("switches to the re-indexing label when indexing restarts after a completed scan", () => {
		const indexingComplete$ = new BehaviorSubject(false);
		renderOverlay(indexingComplete$);

		act(() => indexingComplete$.next(true));
		act(() => indexingComplete$.next(false));

		const overlay = screen.getByTestId(OVERLAY_TESTID);
		expect(overlay).toBeInTheDocument();
		expect(overlay).toHaveTextContent(REINDEXING_TEXT);
	});

	it("exposes a polite live region so the indexing state is announced", () => {
		renderOverlay(new BehaviorSubject(false));

		const overlay = screen.getByTestId(OVERLAY_TESTID);
		expect(overlay).toHaveAttribute("role", "status");
		expect(overlay).toHaveAttribute("aria-live", "polite");
	});
});
