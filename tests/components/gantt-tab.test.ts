import { describe, expect, it } from "vitest";

import { sanitizeGanttId } from "../../src/components/views/gantt-tab";

describe("sanitizeGanttId", () => {
	it("replaces slashes with underscores", () => {
		expect(sanitizeGanttId("Events/meeting.md")).toBe("Events_meeting_md");
	});

	it("replaces spaces with underscores", () => {
		expect(sanitizeGanttId("My Folder/My Event.md")).toBe("My_Folder_My_Event_md");
	});

	it("replaces brackets with underscores", () => {
		expect(sanitizeGanttId("[[Event]]")).toBe("__Event__");
	});

	it("preserves alphanumeric characters", () => {
		expect(sanitizeGanttId("abc123")).toBe("abc123");
	});
});
