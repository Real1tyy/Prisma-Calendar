import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarBundle } from "../../../../src/core/calendar-bundle";
import {
	type PreviewEventData,
	renderEventPreviewInto,
} from "../../../../src/react/modals/preview/event-preview-modal";
import { TFile } from "../../../mocks/obsidian";
import { createMockApp, createMockSingleCalendarSettings } from "../../../setup";

type MockApp = ReturnType<typeof createMockApp> & {
	workspace: { openLinkText: ReturnType<typeof vi.fn> };
};

interface MountResult {
	close: ReturnType<typeof vi.fn>;
	app: MockApp;
}

function buildBundle(overrides: Partial<ReturnType<typeof createMockSingleCalendarSettings>> = {}): CalendarBundle {
	const settings = { ...createMockSingleCalendarSettings(), ...overrides };
	return {
		settingsStore: { currentSettings: settings },
	} as unknown as CalendarBundle;
}

function mountPreview(
	event: PreviewEventData,
	options: {
		bundle?: CalendarBundle;
		frontmatter?: Record<string, unknown>;
	} = {}
): MountResult {
	const app = createMockApp() as MockApp;
	const close = vi.fn();

	if (options.frontmatter) {
		const file = new TFile(event.extendedProps?.filePath ?? "");
		(app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(file);
		(app.metadataCache.getFileCache as ReturnType<typeof vi.fn>).mockReturnValue({
			frontmatter: options.frontmatter,
		});
	}

	app.workspace.openLinkText = vi.fn().mockResolvedValue(undefined);

	const el = document.createElement("div");
	document.body.appendChild(el);
	renderEventPreviewInto(el, app as never, options.bundle ?? buildBundle(), event, close);
	return { close, app };
}

beforeEach(() => {
	document.body.replaceChildren();
});

describe("event-preview characterization", () => {
	const baseEvent: PreviewEventData = {
		title: "Team Meeting",
		start: new Date(2026, 2, 5, 10, 0),
		end: new Date(2026, 2, 5, 11, 30),
		allDay: false,
		extendedProps: { filePath: "Events/team-meeting.md" },
	};

	it("renders modal with the preview testid", () => {
		mountPreview(baseEvent);
		expect(screen.getByTestId("prisma-event-preview-modal")).toBeInTheDocument();
	});

	it("renders title with the title testid and cleaned text", () => {
		mountPreview(baseEvent);
		const title = screen.getByTestId("prisma-event-preview-title");
		expect(title).toHaveTextContent("Team Meeting");
	});

	it("strips zettel id suffixes from the title", () => {
		mountPreview({ ...baseEvent, title: "Workout-20260305000000" });
		expect(screen.getByTestId("prisma-event-preview-title")).toHaveTextContent("Workout");
		expect(screen.getByTestId("prisma-event-preview-title").textContent).not.toMatch(/2026/);
	});

	it("falls back to 'Untitled Event' when the title is empty", () => {
		mountPreview({ ...baseEvent, title: "" });
		expect(screen.getByTestId("prisma-event-preview-title")).toHaveTextContent("Untitled Event");
	});

	it("opens the linked note and closes when the title is clicked", async () => {
		const user = userEvent.setup();
		const { close, app } = mountPreview(baseEvent);
		await user.click(screen.getByTestId("prisma-event-preview-title"));
		expect(app.workspace.openLinkText).toHaveBeenCalledWith("Events/team-meeting.md", "", false);
		expect(close).toHaveBeenCalledOnce();
	});

	it("renders Start, End, and Duration labels for timed events", () => {
		mountPreview(baseEvent);
		expect(screen.getByText("Start")).toBeInTheDocument();
		expect(screen.getByText("End")).toBeInTheDocument();
		expect(screen.getByText("Duration")).toBeInTheDocument();
	});

	it("does not render Duration when only start is provided", () => {
		mountPreview({ ...baseEvent, end: null });
		expect(screen.getByText("Start")).toBeInTheDocument();
		expect(screen.queryByText("End")).not.toBeInTheDocument();
		expect(screen.queryByText("Duration")).not.toBeInTheDocument();
	});

	it("does not render Duration for all-day events", () => {
		mountPreview({ ...baseEvent, allDay: true });
		expect(screen.getByText("Start")).toBeInTheDocument();
		expect(screen.getByText("End")).toBeInTheDocument();
		expect(screen.queryByText("Duration")).not.toBeInTheDocument();
	});

	it("renders 'N/A' when the start date is null", () => {
		mountPreview({ ...baseEvent, start: null });
		expect(screen.getByText("N/A")).toBeInTheDocument();
	});

	it("renders Display Properties when frontmatter contains configured props", () => {
		const bundle = buildBundle({ frontmatterDisplayProperties: ["category"] });
		mountPreview(baseEvent, {
			bundle,
			frontmatter: { category: "Work" },
		});
		expect(screen.getByText("Display Properties")).toBeInTheDocument();
		expect(screen.getByText("category")).toBeInTheDocument();
		expect(screen.getByText("Work")).toBeInTheDocument();
	});

	it("renders Other Properties when frontmatter has non-display keys", () => {
		const bundle = buildBundle({ frontmatterDisplayProperties: ["category"] });
		mountPreview(baseEvent, {
			bundle,
			frontmatter: { project: "Apollo" },
		});
		expect(screen.getByText("Other Properties")).toBeInTheDocument();
		expect(screen.getByText("project")).toBeInTheDocument();
		expect(screen.getByText("Apollo")).toBeInTheDocument();
	});

	it("does not render properties sections when frontmatter is empty", () => {
		mountPreview(baseEvent);
		expect(screen.queryByText("Display Properties")).not.toBeInTheDocument();
		expect(screen.queryByText("Other Properties")).not.toBeInTheDocument();
	});

	it("renders Obsidian links as clickable elements that open the target note", async () => {
		const user = userEvent.setup();
		const bundle = buildBundle({ frontmatterDisplayProperties: ["related"] });
		const { close, app } = mountPreview(baseEvent, {
			bundle,
			frontmatter: { related: "[[Apollo Project]]" },
		});

		const link = screen.getByText("Apollo Project");
		expect(link.tagName).toBe("A");
		await user.click(link);
		expect(app.workspace.openLinkText).toHaveBeenCalledWith("Apollo Project", "", false);
		expect(close).toHaveBeenCalledOnce();
	});

	it("renders multiple display properties in order", () => {
		const bundle = buildBundle({ frontmatterDisplayProperties: ["category", "priority"] });
		mountPreview(baseEvent, {
			bundle,
			frontmatter: { category: "Work", priority: "High" },
		});
		const keyEls = document.querySelectorAll(".prisma-event-preview-prop-key");
		expect(Array.from(keyEls).map((el) => el.textContent)).toEqual(["category", "priority"]);
	});
});
