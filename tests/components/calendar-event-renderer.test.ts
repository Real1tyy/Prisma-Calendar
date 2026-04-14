/**
 * Approval snapshots for `renderEventContent`.
 *
 * The renderer turns FullCalendar's EventContentArg into our custom event DOM
 * (marker + header + title + per-property rows). This test pins exact DOM
 * output for each event shape so any structural or attribute change surfaces
 * in the diff.
 *
 * The event argument is a minimal EventContentArg-shaped stub — enough to
 * satisfy the renderer's field accesses, typed as `any` because FullCalendar's
 * EventImpl has a much larger surface we don't need.
 */
import { renderToApprovalString } from "@real1ty-obsidian-plugins/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderEventContent } from "../../src/components/calendar-event-renderer";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createParserSettings } from "../fixtures/settings-fixtures";
import { createMockApp } from "../setup";

const PINNED_NOW = new Date("2026-04-15T09:00:00Z");

interface EventArgInput {
	title: string;
	start?: Date | null;
	end?: Date | null;
	allDay?: boolean;
	timeText?: string;
	viewType?: string;
	extendedProps?: Record<string, unknown>;
}

function buildArg(input: EventArgInput): any {
	return {
		event: {
			title: input.title,
			start: input.start ?? null,
			end: input.end ?? null,
			allDay: input.allDay ?? false,
			extendedProps: input.extendedProps ?? {},
		},
		view: { type: input.viewType ?? "timeGridWeek" },
		timeText: input.timeText ?? "",
	};
}

function renderHtml(
	arg: ReturnType<typeof buildArg>,
	settings: SingleCalendarConfig = createParserSettings(),
	context: Partial<{ isMobile: boolean; calendarIconCache: Map<string, string | undefined> }> = {}
): string {
	const { domNodes } = renderEventContent(arg, {
		app: createMockApp() as any,
		settings,
		isMobile: context.isMobile ?? false,
		calendarIconCache: context.calendarIconCache ?? new Map(),
	});
	return renderToApprovalString(domNodes[0]);
}

describe("renderEventContent — approval snapshots", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(PINNED_NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("timed event with time text and plain title", async () => {
		const html = renderHtml(
			buildArg({
				title: "Team Meeting",
				start: new Date("2026-04-15T14:00:00Z"),
				end: new Date("2026-04-15T15:00:00Z"),
				timeText: "2:00pm",
			})
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-timed.approved.html");
	});

	it("all-day event hides the time row", async () => {
		const html = renderHtml(
			buildArg({
				title: "Public Holiday",
				start: new Date("2026-07-04T00:00:00Z"),
				allDay: true,
				timeText: "all-day",
			})
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-allday.approved.html");
	});

	it("renders display properties with key/value rows in declared order", async () => {
		const settings = createParserSettings({
			frontmatterDisplayProperties: ["Category", "Location"],
		});
		const html = renderHtml(
			buildArg({
				title: "Project Planning",
				start: new Date("2026-04-15T10:00:00Z"),
				end: new Date("2026-04-15T11:30:00Z"),
				timeText: "10:00am",
				extendedProps: {
					frontmatterDisplayData: {
						Category: "Work",
						Location: "Conference Room A",
					},
				},
			}),
			settings
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-with-props.approved.html");
	});

	it("appends duration to title when showDurationInTitle is enabled", async () => {
		const settings = createParserSettings({ showDurationInTitle: true });
		const html = renderHtml(
			buildArg({
				title: "Long Meeting",
				start: new Date("2026-04-15T09:00:00Z"),
				end: new Date("2026-04-15T11:00:00Z"),
				timeText: "9:00am",
			}),
			settings
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-with-duration.approved.html");
	});

	it("renders a user-icon marker when iconProp is populated", async () => {
		const settings = createParserSettings({ iconProp: "Icon" });
		const html = renderHtml(
			buildArg({
				title: "Workout",
				start: new Date("2026-04-15T06:00:00Z"),
				end: new Date("2026-04-15T07:00:00Z"),
				timeText: "6:00am",
				extendedProps: {
					frontmatterDisplayData: { Icon: "🏃" },
				},
			}),
			settings
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-with-icon.approved.html");
	});

	it("renders the source-recurring marker when rruleProp is set and the toggle is on", async () => {
		const settings = createParserSettings({
			rruleProp: "Recurrence",
			sourceRecurringMarker: "🔁",
			showSourceRecurringMarker: true,
		});
		const html = renderHtml(
			buildArg({
				title: "Weekly Review",
				start: new Date("2026-04-15T17:00:00Z"),
				end: new Date("2026-04-15T17:30:00Z"),
				timeText: "5:00pm",
				extendedProps: {
					frontmatterDisplayData: { Recurrence: "FREQ=WEEKLY" },
				},
			}),
			settings
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-source-recurring.approved.html");
	});

	it("renders the physical-recurring marker when sourceProp is set", async () => {
		const settings = createParserSettings({
			sourceProp: "RecurringSource",
			physicalRecurringMarker: "↻",
			showPhysicalRecurringMarker: true,
		});
		const html = renderHtml(
			buildArg({
				title: "Weekly Review",
				start: new Date("2026-04-22T17:00:00Z"),
				end: new Date("2026-04-22T17:30:00Z"),
				timeText: "5:00pm",
				extendedProps: {
					frontmatterDisplayData: { RecurringSource: "[[Weekly Review]]" },
				},
			}),
			settings
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-physical-recurring.approved.html");
	});

	it("renders the holiday flag marker when virtualKind is 'holiday'", async () => {
		const html = renderHtml(
			buildArg({
				title: "Independence Day",
				start: new Date("2026-07-04T00:00:00Z"),
				allDay: true,
				timeText: "all-day",
				extendedProps: { virtualKind: "holiday" },
			})
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-holiday.approved.html");
	});

	it("strips the time row and display props on mobile monthly view", async () => {
		const settings = createParserSettings({
			frontmatterDisplayProperties: ["Category"],
		});
		const html = renderHtml(
			buildArg({
				title: "Team Meeting",
				start: new Date("2026-04-15T10:00:00Z"),
				end: new Date("2026-04-15T11:00:00Z"),
				timeText: "10:00am",
				viewType: "dayGridMonth",
				extendedProps: {
					frontmatterDisplayData: { Category: "Work" },
				},
			}),
			settings,
			{ isMobile: true }
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-mobile-monthly.approved.html");
	});

	it("renders integration icon when a CalDAV account mapping is present", async () => {
		const iconCache = new Map<string, string | undefined>([["caldav:account-1", "📅"]]);
		const html = renderHtml(
			buildArg({
				title: "Team Meeting",
				start: new Date("2026-04-15T10:00:00Z"),
				end: new Date("2026-04-15T11:00:00Z"),
				timeText: "10:00am",
				extendedProps: {
					frontmatterDisplayData: {
						CalDAV: { accountId: "account-1" },
					},
				},
			}),
			createParserSettings({ caldavProp: "CalDAV" }),
			{ calendarIconCache: iconCache }
		);
		await expect(html).toMatchFileSnapshot("__snapshots__/event-caldav-integration.approved.html");
	});
});
