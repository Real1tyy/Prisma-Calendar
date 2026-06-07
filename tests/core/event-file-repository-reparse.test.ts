import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PARSE_AFFECTING_KEYS, parseAffectingSettingsChanged } from "../../src/core/event-file-repository";
import type { IndexerEvent } from "../../src/types/event-source";
import { createRepoSettings, TestableEventFileRepository } from "../fixtures/event-file-repository-fixtures";
import { createMockApp } from "../setup";

const flush = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

describe("EventFileRepository — live re-parse on parse-affecting settings change", () => {
	let repo: TestableEventFileRepository;
	let settingsStore: BehaviorSubject<any>;

	beforeEach(() => {
		settingsStore = new BehaviorSubject(createRepoSettings());
		repo = new TestableEventFileRepository(createMockApp(), settingsStore);
	});

	afterEach(() => {
		repo.destroy();
	});

	it("re-emits a now-renderable event when the date property is remapped, without rebuilding the table", async () => {
		// Note carries its date under "Scheduled" — invisible while dateProp is the default "Date".
		repo.mockTable.seed("appt", { Scheduled: "2024-06-15", "All Day": true, Title: "Appointment" });
		const tableBefore = repo.getTable();
		const events: IndexerEvent[] = [];
		repo.events$.subscribe((event) => events.push(event));

		settingsStore.next(createRepoSettings({ dateProp: "Scheduled" }));
		await flush();

		expect(events).toContainEqual(expect.objectContaining({ type: "file-changed", filePath: "Events/appt.md" }));
		expect(repo.getTable()).toBe(tableBefore);
	});

	it("re-emits an untracked event for a note that no longer resolves under the new mapping", async () => {
		repo.mockTable.seed("meeting", { "Start Date": "2024-06-15T10:00:00", Title: "Meeting" });
		const events: IndexerEvent[] = [];
		repo.events$.subscribe((event) => events.push(event));

		settingsStore.next(createRepoSettings({ startProp: "Begins" }));
		await flush();

		expect(events).toContainEqual(
			expect.objectContaining({ type: "untracked-file-changed", filePath: "Events/meeting.md" })
		);
	});

	it("re-emits when a non-date metadata mapping changes (icon previously needed a restart)", async () => {
		repo.mockTable.seed("meeting", { "Start Date": "2024-06-15T10:00:00", Title: "Meeting" });
		const events: IndexerEvent[] = [];
		repo.events$.subscribe((event) => events.push(event));

		settingsStore.next(createRepoSettings({ iconProp: "Glyph" }));
		await flush();

		expect(events).toContainEqual(expect.objectContaining({ type: "file-changed", filePath: "Events/meeting.md" }));
	});

	it("does not re-emit when a render-only display property changes", async () => {
		repo.mockTable.seed("meeting", { "Start Date": "2024-06-15T10:00:00", Title: "Meeting" });
		const events: IndexerEvent[] = [];
		repo.events$.subscribe((event) => events.push(event));

		settingsStore.next(createRepoSettings({ frontmatterDisplayProperties: ["Category"] }));
		await flush();

		expect(events).toHaveLength(0);
	});

	it("does not re-emit when a non-parse-affecting setting changes", async () => {
		repo.mockTable.seed("meeting", { "Start Date": "2024-06-15T10:00:00", Title: "Meeting" });
		const events: IndexerEvent[] = [];
		repo.events$.subscribe((event) => events.push(event));

		settingsStore.next(createRepoSettings({ markPastInstancesAsDone: true }));
		await flush();

		expect(events).toHaveLength(0);
	});
});

describe("parseAffectingSettingsChanged", () => {
	it.each(PARSE_AFFECTING_KEYS)("detects a change to %s", (key) => {
		const prev = createRepoSettings();
		const next = createRepoSettings({ [key]: key === "filterExpressions" ? ["status == done"] : "Changed" });
		expect(parseAffectingSettingsChanged(prev, next)).toBe(true);
	});

	it("ignores a change to an unrelated setting", () => {
		const prev = createRepoSettings();
		const next = createRepoSettings({ markPastInstancesAsDone: true });
		expect(parseAffectingSettingsChanged(prev, next)).toBe(false);
	});
});
