import type { ColorEvaluator } from "@real1ty-obsidian-plugins";
import { describe, expect, it, vi } from "vitest";

import type { CalendarBundle } from "../../src/core/calendar-bundle";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { mapEventToItem } from "../../src/utils/events/event-list-mapping";
import { createMockTimedEvent } from "../fixtures/event-fixtures";
import { createParserSettings } from "../fixtures/settings-fixtures";

interface BundleStub {
	settings: SingleCalendarConfig;
	caldavColor: string;
	icsColor: string;
}

function makeBundle(stub: Partial<BundleStub> = {}): CalendarBundle {
	const settings = stub.settings ?? createParserSettings();
	return {
		settingsStore: { currentSettings: settings },
		getCalDAVSettings: () => ({ integrationEventColor: stub.caldavColor ?? "" }),
		getICSSubscriptionSettings: () => ({ integrationEventColor: stub.icsColor ?? "" }),
	} as unknown as CalendarBundle;
}

function makeEvaluator(color = "#abcdef"): ColorEvaluator<SingleCalendarConfig> {
	return {
		evaluateColor: vi.fn().mockReturnValue(color),
		evaluateAllColors: vi.fn().mockReturnValue([color]),
	} as unknown as ColorEvaluator<SingleCalendarConfig>;
}

describe("mapEventToItem", () => {
	it("strips zettel id from the title", () => {
		const event = createMockTimedEvent({ title: "Team Meeting-20260315090000" });
		const item = mapEventToItem(event, makeBundle(), makeEvaluator());
		expect(item.title).toBe("Team Meeting");
	});

	it("leaves titles without a zettel id untouched", () => {
		const event = createMockTimedEvent({ title: "Team Meeting" });
		const item = mapEventToItem(event, makeBundle(), makeEvaluator());
		expect(item.title).toBe("Team Meeting");
	});

	it("propagates id and ref.filePath onto the list item", () => {
		const event = createMockTimedEvent({ id: "evt-42", ref: { filePath: "Events/Foo.md" } });
		const item = mapEventToItem(event, makeBundle(), makeEvaluator());
		expect(item.id).toBe("evt-42");
		expect(item.filePath).toBe("Events/Foo.md");
	});

	it("formats subtitle as date + duration for timed events", () => {
		const event = createMockTimedEvent({
			start: "2026-03-15T09:00:00",
			end: "2026-03-15T10:30:00",
		});
		const item = mapEventToItem(event, makeBundle(), makeEvaluator());
		expect(item.subtitle).toMatch(/^Mar 15, 2026 - 9:00 AM \(1 hour 30 min/);
	});

	it("uses the evaluator's color when no integration color is configured", () => {
		const evaluator = makeEvaluator("#deadbe");
		const event = createMockTimedEvent();
		const item = mapEventToItem(event, makeBundle(), evaluator);
		expect(item.categoryColor).toBe("#deadbe");
		expect(evaluator.evaluateColor).toHaveBeenCalledTimes(1);
	});

	it("prefers a CalDAV integration color when the event has the CalDAV prop set", () => {
		const settings = createParserSettings({ caldavProp: "CalDAV" });
		const event = createMockTimedEvent({ meta: { CalDAV: { uid: "abc" } } });
		const evaluator = makeEvaluator("#fallback");
		const item = mapEventToItem(event, makeBundle({ settings, caldavColor: "#123456" }), evaluator);
		expect(item.categoryColor).toBe("#123456");
		expect(evaluator.evaluateColor).not.toHaveBeenCalled();
	});

	it("prefers an ICS integration color when the event has the ICS prop set", () => {
		const settings = createParserSettings({ icsSubscriptionProp: "ICSSubscription" });
		const event = createMockTimedEvent({ meta: { ICSSubscription: { feedId: "f1" } } });
		const evaluator = makeEvaluator("#fallback");
		const item = mapEventToItem(event, makeBundle({ settings, icsColor: "#abcdef" }), evaluator);
		expect(item.categoryColor).toBe("#abcdef");
		expect(evaluator.evaluateColor).not.toHaveBeenCalled();
	});
});
