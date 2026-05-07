import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const applyMultiColorIndicators = vi.hoisted(() => vi.fn());
vi.mock("../../../../src/components/calendar-event-renderer", () => ({
	applyMultiColorIndicators,
}));

import { EventSeriesEventRow } from "../../../../src/react/modals/event-list/event-series-event-row";
import type { EventRowItem } from "../../../../src/react/modals/event-list/event-series-types";

const SETTINGS = { colorMode: "off", showEventColorDots: false } as const;

function makeItem(overrides: Partial<EventRowItem> = {}): EventRowItem {
	return {
		date: DateTime.fromISO("2026-03-15T09:00:00"),
		title: "Team Meeting",
		filePath: "events/Team Meeting.md",
		skipped: false,
		...overrides,
	};
}

beforeEach(() => {
	applyMultiColorIndicators.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("EventSeriesEventRow", () => {
	it("renders title and formatted date", () => {
		render(<EventSeriesEventRow item={makeItem()} isPast={false} settings={SETTINGS} onClick={vi.fn()} />);
		expect(screen.getByText("Team Meeting")).toBeTruthy();
		expect(screen.getByText("2026-03-15 (Sun)")).toBeTruthy();
	});

	it("adds the past class when isPast is true", () => {
		const { container } = render(
			<EventSeriesEventRow item={makeItem()} isPast={true} settings={SETTINGS} onClick={vi.fn()} />
		);
		const row = container.querySelector(".prisma-recurring-event-row") as HTMLElement;
		expect(row.classList.contains("prisma-recurring-event-past")).toBe(true);
	});

	it("does not add the past class when isPast is false", () => {
		const { container } = render(
			<EventSeriesEventRow item={makeItem()} isPast={false} settings={SETTINGS} onClick={vi.fn()} />
		);
		const row = container.querySelector(".prisma-recurring-event-row") as HTMLElement;
		expect(row.classList.contains("prisma-recurring-event-past")).toBe(false);
	});

	it("applies single-color CSS variable when item.color is set", () => {
		const { container } = render(
			<EventSeriesEventRow item={makeItem({ color: "#ff0000" })} isPast={false} settings={SETTINGS} onClick={vi.fn()} />
		);
		const row = container.querySelector(".prisma-recurring-event-row") as HTMLElement;
		expect(row.style.getPropertyValue("--event-color")).toBe("#ff0000");
		expect(row.classList.contains("prisma-recurring-event-colorized")).toBe(true);
	});

	it("marks skipped instances with a skipped class on the title", () => {
		const { container } = render(
			<EventSeriesEventRow item={makeItem({ skipped: true })} isPast={false} settings={SETTINGS} onClick={vi.fn()} />
		);
		const titleEl = container.querySelector(".prisma-recurring-event-title") as HTMLElement;
		expect(titleEl.classList.contains("prisma-recurring-event-skipped")).toBe(true);
	});

	it("calls onClick when the row is clicked", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		render(<EventSeriesEventRow item={makeItem()} isPast={false} settings={SETTINGS} onClick={onClick} />);
		await user.click(screen.getByText("Team Meeting"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("invokes applyMultiColorIndicators when allColors has 2+ colors", () => {
		render(
			<EventSeriesEventRow
				item={makeItem({ color: "#ff0000", allColors: ["#ff0000", "#00ff00", "#0000ff"] })}
				isPast={false}
				settings={SETTINGS}
				onClick={vi.fn()}
			/>
		);
		expect(applyMultiColorIndicators).toHaveBeenCalledTimes(1);
		const [el, colors, settings, options] = applyMultiColorIndicators.mock.calls[0];
		expect((el as HTMLElement).classList.contains("prisma-recurring-event-row")).toBe(true);
		expect(colors).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
		expect(settings).toEqual(SETTINGS);
		expect(options).toEqual({ maxDots: 4, colorMixRatio: 0.15 });
	});

	it("does not call applyMultiColorIndicators when allColors is omitted or has < 2", () => {
		render(<EventSeriesEventRow item={makeItem()} isPast={false} settings={SETTINGS} onClick={vi.fn()} />);
		expect(applyMultiColorIndicators).not.toHaveBeenCalled();

		render(
			<EventSeriesEventRow
				item={makeItem({ allColors: ["#ff0000"] })}
				isPast={false}
				settings={SETTINGS}
				onClick={vi.fn()}
			/>
		);
		expect(applyMultiColorIndicators).not.toHaveBeenCalled();
	});

	it("cleans up multi-color indicator side effects on unmount", () => {
		const { container, unmount } = render(
			<EventSeriesEventRow
				item={makeItem({ allColors: ["#ff0000", "#00ff00"] })}
				isPast={false}
				settings={SETTINGS}
				onClick={vi.fn()}
			/>
		);
		const row = container.querySelector(".prisma-recurring-event-row") as HTMLElement;
		row.style.setProperty("background-image", "linear-gradient(red, green)");
		row.style.setProperty("border-color", "red");
		const dots = document.createElement("div");
		dots.className = "prisma-inline-color-dots";
		row.appendChild(dots);

		unmount();

		expect(row.style.getPropertyValue("background-image")).toBe("");
		expect(row.style.getPropertyValue("border-color")).toBe("");
		expect(row.querySelector(".prisma-inline-color-dots")).toBeNull();
	});
});
