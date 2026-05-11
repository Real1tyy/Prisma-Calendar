import "@testing-library/jest-dom/vitest";

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterBar, type FilterBarHandle } from "../../../src/react/views/filter-bar";
import { createMockTimedEvent } from "../../fixtures/event-fixtures";
import { createMockReactBundle, renderWithContexts } from "../../fixtures/react-view-fixtures";

describe("FilterBar", () => {
	it("renders search and expression inputs with stable test ids", () => {
		renderWithContexts(<FilterBar onFilterChange={vi.fn()} onHandleReady={vi.fn()} />);

		expect(screen.getByTestId("prisma-filter-bar")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-filter-search")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-filter-expression")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-filter-preset")).toBeInTheDocument();
	});

	it("publishes a shouldInclude handle on mount that filters by title", () => {
		const onHandleReady = vi.fn<(h: FilterBarHandle) => void>();
		renderWithContexts(<FilterBar onFilterChange={vi.fn()} onHandleReady={onHandleReady} />);

		expect(onHandleReady).toHaveBeenCalledTimes(1);
		const handle = onHandleReady.mock.calls[0]![0];
		const event = createMockTimedEvent({ title: "Team Meeting" });
		expect(handle.shouldInclude(event)).toBe(true);
	});

	it("commits the search value on Enter and notifies onFilterChange", async () => {
		const onFilterChange = vi.fn();
		const onHandleReady = vi.fn<(h: FilterBarHandle) => void>();
		const user = userEvent.setup();

		renderWithContexts(<FilterBar onFilterChange={onFilterChange} onHandleReady={onHandleReady} />);

		const search = screen.getByTestId("prisma-filter-search") as HTMLInputElement;
		await user.click(search);
		await user.keyboard("Meeting{Enter}");

		expect(onFilterChange).toHaveBeenCalled();
		const handle = onHandleReady.mock.calls.at(-1)![0];
		expect(handle.shouldInclude(createMockTimedEvent({ title: "Team Meeting" }))).toBe(true);
		expect(handle.shouldInclude(createMockTimedEvent({ title: "Workout" }))).toBe(false);
	});

	it("commits the search value after the debounce timer fires", async () => {
		const onFilterChange = vi.fn();
		const onHandleReady = vi.fn<(h: FilterBarHandle) => void>();
		const user = userEvent.setup();

		renderWithContexts(<FilterBar onFilterChange={onFilterChange} onHandleReady={onHandleReady} />);

		const search = screen.getByTestId("prisma-filter-search") as HTMLInputElement;
		await user.click(search);
		await user.type(search, "Workout");

		await waitFor(() => expect(onFilterChange).toHaveBeenCalled());
		const handle = onHandleReady.mock.calls.at(-1)![0];
		expect(handle.shouldInclude(createMockTimedEvent({ title: "Workout" }))).toBe(true);
		expect(handle.shouldInclude(createMockTimedEvent({ title: "Lunch" }))).toBe(false);
	});

	it("does not call onFilterChange synchronously while user is still typing", async () => {
		const onFilterChange = vi.fn();
		const user = userEvent.setup();

		renderWithContexts(<FilterBar onFilterChange={onFilterChange} onHandleReady={vi.fn()} />, {
			bundle: createMockReactBundle(),
		});

		const search = screen.getByTestId("prisma-filter-search") as HTMLInputElement;
		await user.click(search);
		await user.type(search, "a");

		expect(onFilterChange).not.toHaveBeenCalled();
	});
});
