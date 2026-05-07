import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DateTime } from "luxon";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/components/calendar-event-renderer", () => ({
	applyMultiColorIndicators: vi.fn(),
}));

import type { CalendarBundle } from "../../../../src/core/calendar-bundle";
import { EventSeriesInstancesList } from "../../../../src/react/modals/event-list/event-series-instances-list";
import type { EventListOptions, EventRowItem } from "../../../../src/react/modals/event-list/event-series-types";
import { createMockCalendarSettingsStore } from "../../../fixtures/settings-fixtures";

interface BundleStub {
	openLinkText: ReturnType<typeof vi.fn>;
	bundle: CalendarBundle;
}

function makeBundle(): BundleStub {
	const settingsStore = createMockCalendarSettingsStore();
	const openLinkText = vi.fn();
	return {
		openLinkText,
		bundle: {
			settingsStore,
			plugin: {
				app: { workspace: { openLinkText } },
			},
		} as unknown as CalendarBundle,
	};
}

function makeRow(date: DateTime, overrides: Partial<EventRowItem> = {}): EventRowItem {
	return {
		date,
		title: `Event @ ${date.toISODate()}`,
		filePath: `events/${date.toISODate()}.md`,
		skipped: false,
		...overrides,
	};
}

function makeOptions(overrides: Partial<EventListOptions> = {}): EventListOptions {
	return {
		hidePast: false,
		hideSkipped: false,
		onHidePastChange: vi.fn(),
		onHideSkippedChange: vi.fn(),
		...overrides,
	};
}

function rowTitles(): string[] {
	return Array.from(document.querySelectorAll(".prisma-recurring-event-title")).map((el) => el.textContent);
}

const TODAY = DateTime.now().startOf("day");

afterEach(() => {
	vi.restoreAllMocks();
});

describe("EventSeriesInstancesList", () => {
	function renderList(props: {
		items: EventRowItem[];
		options?: Partial<EventListOptions>;
		bundle?: CalendarBundle;
		showSearch?: boolean;
		searchQuery?: string;
		onSearchChange?: (q: string) => void;
	}) {
		const stub = makeBundle();
		const onSearchChange = props.onSearchChange ?? vi.fn();
		const showSearchProp = props.showSearch === undefined ? {} : { showSearch: props.showSearch };
		const result = render(
			<EventSeriesInstancesList
				items={props.items}
				options={makeOptions(props.options)}
				searchQuery={props.searchQuery ?? ""}
				onSearchChange={onSearchChange}
				bundle={props.bundle ?? stub.bundle}
				{...showSearchProp}
			/>
		);
		return { ...result, openLinkText: stub.openLinkText, onSearchChange };
	}

	it("renders empty state when there are no items", () => {
		renderList({ items: [] });
		expect(screen.getByText("No events found")).toBeTruthy();
	});

	it("hides past events when hidePast is true and sorts ascending", () => {
		const items = [
			makeRow(TODAY.minus({ days: 5 })),
			makeRow(TODAY.plus({ days: 1 })),
			makeRow(TODAY.plus({ days: 3 })),
		];
		renderList({ items, options: { hidePast: true } });
		const titles = rowTitles();
		expect(titles).toHaveLength(2);
		expect(titles[0]).toContain(TODAY.plus({ days: 1 }).toISODate());
		expect(titles[1]).toContain(TODAY.plus({ days: 3 }).toISODate());
	});

	it("includes past events and sorts descending when hidePast is false", () => {
		const items = [
			makeRow(TODAY.minus({ days: 5 })),
			makeRow(TODAY.plus({ days: 1 })),
			makeRow(TODAY.minus({ days: 1 })),
		];
		renderList({ items, options: { hidePast: false } });
		const titles = rowTitles();
		expect(titles).toHaveLength(3);
		expect(titles[0]).toContain(TODAY.plus({ days: 1 }).toISODate());
		expect(titles[2]).toContain(TODAY.minus({ days: 5 }).toISODate());
	});

	it("hides skipped events when hideSkipped is true", () => {
		const items = [
			makeRow(TODAY.plus({ days: 1 }), { skipped: true }),
			makeRow(TODAY.plus({ days: 2 }), { skipped: false }),
		];
		renderList({ items, options: { hideSkipped: true } });
		const titles = rowTitles();
		expect(titles).toHaveLength(1);
		expect(titles[0]).toContain(TODAY.plus({ days: 2 }).toISODate());
	});

	it("filters by search query on title (case-insensitive substring)", () => {
		const items = [
			makeRow(TODAY.plus({ days: 1 }), { title: "Team Meeting" }),
			makeRow(TODAY.plus({ days: 2 }), { title: "Code Review" }),
			makeRow(TODAY.plus({ days: 3 }), { title: "Deep work" }),
		];
		renderList({ items, searchQuery: "MEETING" });
		expect(rowTitles()).toEqual(["Team Meeting"]);
	});

	it("calls onSearchChange when typing in the search input", async () => {
		const items = [makeRow(TODAY.plus({ days: 1 }))];
		const onSearchChange = vi.fn();
		const { rerender } = render(
			<EventSeriesInstancesList
				items={items}
				options={makeOptions()}
				searchQuery=""
				onSearchChange={onSearchChange}
				bundle={makeBundle().bundle}
			/>
		);
		const user = userEvent.setup();
		const input = screen.getByPlaceholderText(/Search instances/);
		await user.type(input, "x");
		expect(onSearchChange).toHaveBeenCalled();
		rerender(<></>);
	});

	it("hides the search input when showSearch is false", () => {
		const items = [makeRow(TODAY.plus({ days: 1 }))];
		renderList({ items, showSearch: false });
		expect(screen.queryByPlaceholderText(/Search instances/)).toBeNull();
	});

	it("renders title and routes title click when onTitleClick is provided", async () => {
		const onTitleClick = vi.fn();
		const items = [makeRow(TODAY.plus({ days: 1 }))];
		renderList({
			items,
			options: { title: "Team Meeting", onTitleClick },
		});
		const user = userEvent.setup();
		await user.click(screen.getByText("Team Meeting"));
		expect(onTitleClick).toHaveBeenCalledTimes(1);
	});

	it("opens the file in the workspace when a row is clicked", async () => {
		const items = [makeRow(TODAY.plus({ days: 1 }), { filePath: "events/foo.md", title: "Foo" })];
		const { openLinkText } = renderList({ items });
		const user = userEvent.setup();
		await user.click(screen.getByText("Foo"));
		expect(openLinkText).toHaveBeenCalledWith("events/foo.md", "", false);
	});

	it("invokes filter toggles when their checkbox containers are clicked", async () => {
		const items = [makeRow(TODAY.plus({ days: 1 }))];
		const onHidePastChange = vi.fn();
		const onHideSkippedChange = vi.fn();
		renderList({ items, options: { onHidePastChange, onHideSkippedChange } });
		const user = userEvent.setup();

		const pastToggle = screen
			.getByText("Hide past events")
			.closest(".setting-item")!
			.querySelector(".checkbox-container")!;
		await user.click(pastToggle);
		expect(onHidePastChange).toHaveBeenCalledWith(true);

		const skippedToggle = screen
			.getByText("Hide skipped events")
			.closest(".setting-item")!
			.querySelector(".checkbox-container")!;
		await user.click(skippedToggle);
		expect(onHideSkippedChange).toHaveBeenCalledWith(true);
	});

	it("renders summary stats reflecting total / past / skipped", () => {
		const items = [
			makeRow(TODAY.minus({ days: 2 }), { skipped: false }),
			makeRow(TODAY.minus({ days: 1 }), { skipped: true }),
			makeRow(TODAY.plus({ days: 1 }), { skipped: false }),
		];
		renderList({ items });
		const stats = document.querySelector(".prisma-recurring-events-stats")!;
		expect(within(stats as HTMLElement).getByText(/Total: 3/)).toBeTruthy();
		expect(within(stats as HTMLElement).getByText(/Past: 2/)).toBeTruthy();
		expect(within(stats as HTMLElement).getByText(/Skipped: 1/)).toBeTruthy();
	});

	it("renders extraInfo content above the stats", () => {
		const items = [makeRow(TODAY.plus({ days: 1 }))];
		renderList({
			items,
			options: { extraInfo: <div data-testid="extra">Extra info row</div> },
		});
		expect(screen.getByTestId("extra")).toBeTruthy();
	});
});
