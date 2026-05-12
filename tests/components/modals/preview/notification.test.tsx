import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type NotificationEventData,
	renderNotificationContentInto,
} from "../../../../src/react/modals/preview/notification-modal";
import type { SingleCalendarConfig } from "../../../../src/types/settings";
import { createMockApp, createMockSingleCalendarSettings } from "../../../setup";

type MockApp = ReturnType<typeof createMockApp> & {
	workspace: { openLinkText: ReturnType<typeof vi.fn> };
};

interface MountResult {
	close: ReturnType<typeof vi.fn>;
	onSnooze: ReturnType<typeof vi.fn>;
	app: MockApp;
}

function buildSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createMockSingleCalendarSettings(),
		snoozeMinutes: 5,
		...overrides,
	} as SingleCalendarConfig;
}

function mountNotification(
	eventData: NotificationEventData,
	options: { settings?: SingleCalendarConfig; withSnooze?: boolean } = {}
): MountResult {
	const app = createMockApp() as MockApp;
	const close = vi.fn();
	const onSnooze = vi.fn();
	app.workspace.openLinkText = vi.fn().mockResolvedValue(undefined);

	const el = document.createElement("div");
	document.body.appendChild(el);
	renderNotificationContentInto(
		el,
		app as never,
		eventData,
		options.settings ?? buildSettings(),
		close,
		options.withSnooze ? onSnooze : undefined
	);
	return { close, onSnooze, app };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date(2026, 2, 5, 9, 0));
});

afterEach(() => {
	vi.useRealTimers();
	document.body.replaceChildren();
});

const timedEvent: NotificationEventData = {
	title: "Team Meeting",
	filePath: "Events/team-meeting.md",
	startDate: new Date(2026, 2, 5, 10, 0),
	isAllDay: false,
	frontmatter: { category: "Work" },
};

const allDayEvent: NotificationEventData = {
	title: "Workout",
	filePath: "Events/workout.md",
	startDate: new Date(2026, 2, 5, 0, 0),
	isAllDay: true,
	frontmatter: { category: "Fitness" },
};

describe("notification characterization", () => {
	it("renders title with bell emoji and clean zettel-stripped text", () => {
		mountNotification({ ...timedEvent, title: "Team Meeting-20260305000000" });
		expect(screen.getByText("🔔 Team Meeting")).toBeInTheDocument();
	});

	it("opens the linked note and closes when the title is clicked", async () => {
		const user = userEvent.setup();
		const { close, app } = mountNotification(timedEvent);
		await user.click(screen.getByText("🔔 Team Meeting"));
		expect(app.workspace.openLinkText).toHaveBeenCalledWith("Events/team-meeting.md", "", false);
		expect(close).toHaveBeenCalledOnce();
	});

	it("renders the Start and File labels", () => {
		mountNotification(timedEvent);
		expect(screen.getByText("Start")).toBeInTheDocument();
		expect(screen.getByText("File")).toBeInTheDocument();
		expect(screen.getByText("Events/team-meeting.md")).toBeInTheDocument();
	});

	it("opens the file when the file link is clicked", async () => {
		const user = userEvent.setup();
		const { close, app } = mountNotification(timedEvent);
		await user.click(screen.getByText("Events/team-meeting.md"));
		expect(app.workspace.openLinkText).toHaveBeenCalledWith("Events/team-meeting.md", "", false);
		expect(close).toHaveBeenCalledOnce();
	});

	it("renders the timing line with minutes-until for upcoming timed events", () => {
		mountNotification({ ...timedEvent, startDate: new Date(2026, 2, 5, 9, 30) });
		expect(screen.getByText(/In 30 minutes/)).toBeInTheDocument();
	});

	it("renders 'Event started at …' for past timed events", () => {
		mountNotification({ ...timedEvent, startDate: new Date(2026, 2, 5, 8, 30) });
		expect(screen.getByText(/Event started at/)).toBeInTheDocument();
	});

	it("renders 'Event is today' for an all-day event today", () => {
		mountNotification(allDayEvent);
		expect(screen.getByText("Event is today")).toBeInTheDocument();
	});

	it("renders 'Event is tomorrow' for an all-day event tomorrow", () => {
		mountNotification({ ...allDayEvent, startDate: new Date(2026, 2, 6, 0, 0) });
		expect(screen.getByText("Event is tomorrow")).toBeInTheDocument();
	});

	it("renders the Open button with the open testid and opens the file when clicked", async () => {
		const user = userEvent.setup();
		const { close, app } = mountNotification(timedEvent);
		const open = screen.getByTestId("prisma-notification-open");
		expect(open).toHaveTextContent("Open event");
		await user.click(open);
		expect(app.workspace.openLinkText).toHaveBeenCalledWith("Events/team-meeting.md", "", false);
		expect(close).toHaveBeenCalledOnce();
	});

	it("renders the Dismiss button with the dismiss testid and closes when clicked", async () => {
		const user = userEvent.setup();
		const { close } = mountNotification(timedEvent);
		const dismiss = screen.getByTestId("prisma-notification-dismiss");
		expect(dismiss).toHaveTextContent("Dismiss");
		await user.click(dismiss);
		expect(close).toHaveBeenCalledOnce();
	});

	it("renders the Snooze control for timed events when onSnooze is provided", () => {
		mountNotification(timedEvent, { withSnooze: true });
		expect(screen.getByRole("button", { name: "Snooze" })).toBeInTheDocument();
		expect(screen.getByText("Min")).toBeInTheDocument();
	});

	it("calls onSnooze and closes when Snooze is clicked with a valid duration", async () => {
		const user = userEvent.setup();
		const { close, onSnooze } = mountNotification(timedEvent, { withSnooze: true });
		await user.click(screen.getByRole("button", { name: "Snooze" }));
		expect(onSnooze).toHaveBeenCalledOnce();
		expect(close).toHaveBeenCalledOnce();
	});

	it("does not render the Snooze control for all-day events", () => {
		mountNotification(allDayEvent, { withSnooze: true });
		expect(screen.queryByRole("button", { name: "Snooze" })).not.toBeInTheDocument();
	});

	it("does not render the Snooze control when onSnooze is omitted", () => {
		mountNotification(timedEvent);
		expect(screen.queryByRole("button", { name: "Snooze" })).not.toBeInTheDocument();
	});

	it("seeds the snooze input from settings.snoozeMinutes", () => {
		mountNotification(timedEvent, {
			settings: buildSettings({ snoozeMinutes: 15 }),
			withSnooze: true,
		});
		const input = document.querySelector<HTMLInputElement>(".prisma-event-notification-snooze-input");
		expect(input?.value).toBe("15");
	});

	it("renders Event Properties section when frontmatter has configured display props", () => {
		const settings = buildSettings({ frontmatterDisplayProperties: ["category"] });
		mountNotification({ ...timedEvent, frontmatter: { category: "Work" } }, { settings, withSnooze: false });
		expect(screen.getByText("Event Properties")).toBeInTheDocument();
		expect(screen.getByText("category")).toBeInTheDocument();
		expect(screen.getByText("Work")).toBeInTheDocument();
	});

	it("renders Additional Properties section when frontmatter has non-display props", () => {
		const settings = buildSettings({ frontmatterDisplayProperties: ["category"] });
		mountNotification({ ...timedEvent, frontmatter: { project: "Apollo" } }, { settings, withSnooze: false });
		expect(screen.getByText("Additional Properties")).toBeInTheDocument();
		expect(screen.getByText("project")).toBeInTheDocument();
		expect(screen.getByText("Apollo")).toBeInTheDocument();
	});
});
