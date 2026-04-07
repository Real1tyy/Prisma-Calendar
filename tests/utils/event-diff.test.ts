import { describe, expect, it } from "vitest";

import type { PrismaEventInput } from "../../src/types/calendar";
import { diffEvents, eventFingerprint } from "../../src/utils/event-diff";
import { buildPreviousMap, createPrismaEventInput as makeEvent } from "../fixtures";

// ---------------------------------------------------------------------------
// eventFingerprint
// ---------------------------------------------------------------------------

describe("eventFingerprint", () => {
	it("should produce a deterministic string for the same event", () => {
		const ev = makeEvent({ id: "a" });
		expect(eventFingerprint(ev)).toBe(eventFingerprint(ev));
	});

	it("should produce identical fingerprints for structurally equal events", () => {
		const a = makeEvent({ id: "a" });
		const b = makeEvent({ id: "a" });
		expect(eventFingerprint(a)).toBe(eventFingerprint(b));
	});

	it("should differ when title changes", () => {
		const a = makeEvent({ id: "a", title: "Original" });
		const b = makeEvent({ id: "a", title: "Updated" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when start changes", () => {
		const a = makeEvent({ id: "a", start: "2024-03-15T09:00:00" });
		const b = makeEvent({ id: "a", start: "2024-03-15T10:00:00" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when end changes", () => {
		const a = makeEvent({ id: "a", end: "2024-03-15T10:00:00" });
		const b = makeEvent({ id: "a", end: "2024-03-15T11:00:00" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when allDay changes", () => {
		const a = makeEvent({ id: "a", allDay: false });
		const b = makeEvent({ id: "a", allDay: true });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when backgroundColor changes", () => {
		const a = makeEvent({ id: "a", backgroundColor: "#ff0000" });
		const b = makeEvent({ id: "a", backgroundColor: "#00ff00" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when borderColor changes", () => {
		const a = makeEvent({ id: "a", borderColor: "#ff0000" });
		const b = makeEvent({ id: "a", borderColor: "#00ff00" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when className changes", () => {
		const a = makeEvent({ id: "a", className: "regular-event" });
		const b = makeEvent({ id: "a", className: "regular-event prisma-virtual-event" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when frontmatterDisplayData changes", () => {
		const a = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: { Category: "Work" },
				virtualKind: "none",
				skipped: false,
			},
		});
		const b = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: { Category: "Personal" },
				virtualKind: "none",
				skipped: false,
			},
		});
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when filePath changes", () => {
		const a = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "events/a.md",
				folder: "events",
				originalTitle: "Event",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		const b = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "events/b.md",
				folder: "events",
				originalTitle: "Event",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when folder changes", () => {
		const a = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "events",
				originalTitle: "Event",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		const b = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "archive",
				originalTitle: "Event",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when originalTitle changes", () => {
		const a = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Alpha",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		const b = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Beta",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should differ when virtualKind changes", () => {
		const a = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: {},
				virtualKind: "none",
				skipped: false,
			},
		});
		const b = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: {},
				virtualKind: "recurring",
				skipped: false,
			},
		});
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should handle missing optional fields gracefully", () => {
		const ev = makeEvent({ id: "a" });
		// Should not throw
		const fp = eventFingerprint(ev);
		expect(typeof fp).toBe("string");
		expect(fp.length).toBeGreaterThan(0);
	});

	it("should use NUL separator so adjacent field values cannot collide", () => {
		// "ab" + "" vs "" + "ab" should produce different fingerprints
		const a = makeEvent({ id: "a", title: "ab", start: "" });
		const b = makeEvent({ id: "a", title: "", start: "ab" });
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});

	it("should handle complex frontmatter display data", () => {
		const ev = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: {
					Category: ["Work", "Meeting"],
					Priority: 1,
					Tags: null,
					Nested: { a: { b: "c" } },
				},
				virtualKind: "none",
				skipped: false,
			},
		});
		const fp = eventFingerprint(ev);
		expect(typeof fp).toBe("string");
		// Same data should give same fingerprint
		const ev2 = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: {
					Category: ["Work", "Meeting"],
					Priority: 1,
					Tags: null,
					Nested: { a: { b: "c" } },
				},
				virtualKind: "none",
				skipped: false,
			},
		});
		expect(eventFingerprint(ev2)).toBe(fp);
	});

	it("should differ when frontmatter array order changes", () => {
		const a = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: { Tags: ["a", "b"] },
				virtualKind: "none",
				skipped: false,
			},
		});
		const b = makeEvent({
			id: "a",
			extendedProps: {
				filePath: "test.md",
				folder: "",
				originalTitle: "Event",
				frontmatterDisplayData: { Tags: ["b", "a"] },
				virtualKind: "none",
				skipped: false,
			},
		});
		expect(eventFingerprint(a)).not.toBe(eventFingerprint(b));
	});
});

// ---------------------------------------------------------------------------
// diffEvents
// ---------------------------------------------------------------------------

describe("diffEvents", () => {
	describe("empty cases", () => {
		it("should return empty diff when both previous and next are empty", () => {
			const diff = diffEvents(new Map(), []);
			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});

		it("should treat all events as added when previous is empty", () => {
			const ev1 = makeEvent({ id: "1" });
			const ev2 = makeEvent({ id: "2" });
			const diff = diffEvents(new Map(), [ev1, ev2]);

			expect(diff.added).toEqual([ev1, ev2]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});

		it("should treat all events as removed when next is empty", () => {
			const ev1 = makeEvent({ id: "1" });
			const ev2 = makeEvent({ id: "2" });
			const previous = buildPreviousMap([ev1, ev2]);

			const diff = diffEvents(previous, []);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual(expect.arrayContaining(["1", "2"]));
			expect(diff.removed).toHaveLength(2);
			expect(diff.changed).toEqual([]);
		});
	});

	describe("no changes", () => {
		it("should return empty diff when events are identical", () => {
			const ev1 = makeEvent({ id: "1", title: "Meeting" });
			const ev2 = makeEvent({ id: "2", title: "Lunch" });
			const previous = buildPreviousMap([ev1, ev2]);

			const diff = diffEvents(previous, [ev1, ev2]);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});

		it("should return empty diff for a single unchanged event", () => {
			const ev = makeEvent({ id: "solo" });
			const previous = buildPreviousMap([ev]);

			const diff = diffEvents(previous, [ev]);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});
	});

	describe("additions only", () => {
		it("should detect a single new event", () => {
			const existing = makeEvent({ id: "1" });
			const added = makeEvent({ id: "2", title: "New" });
			const previous = buildPreviousMap([existing]);

			const diff = diffEvents(previous, [existing, added]);

			expect(diff.added).toEqual([added]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});

		it("should detect multiple new events", () => {
			const previous = buildPreviousMap([makeEvent({ id: "1" })]);
			const newEvents = [makeEvent({ id: "1" }), makeEvent({ id: "2" }), makeEvent({ id: "3" })];

			const diff = diffEvents(previous, newEvents);

			expect(diff.added).toHaveLength(2);
			expect(diff.added.map((e) => e.id)).toEqual(["2", "3"]);
		});
	});

	describe("removals only", () => {
		it("should detect a single removed event", () => {
			const ev1 = makeEvent({ id: "1" });
			const ev2 = makeEvent({ id: "2" });
			const previous = buildPreviousMap([ev1, ev2]);

			const diff = diffEvents(previous, [ev1]);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual(["2"]);
			expect(diff.changed).toEqual([]);
		});

		it("should detect multiple removed events", () => {
			const events = [makeEvent({ id: "1" }), makeEvent({ id: "2" }), makeEvent({ id: "3" })];
			const previous = buildPreviousMap(events);

			const diff = diffEvents(previous, [events[1]]);

			expect(diff.removed).toEqual(expect.arrayContaining(["1", "3"]));
			expect(diff.removed).toHaveLength(2);
		});
	});

	describe("changes only", () => {
		it("should detect a title change", () => {
			const original = makeEvent({ id: "1", title: "Original" });
			const updated = makeEvent({ id: "1", title: "Updated" });
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([updated]);
		});

		it("should detect a color change", () => {
			const original = makeEvent({ id: "1", backgroundColor: "#ff0000", borderColor: "#ff0000" });
			const updated = makeEvent({ id: "1", backgroundColor: "#00ff00", borderColor: "#00ff00" });
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toEqual([updated]);
		});

		it("should detect a date change", () => {
			const original = makeEvent({ id: "1", start: "2024-03-15T09:00:00" });
			const updated = makeEvent({ id: "1", start: "2024-03-16T09:00:00" });
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toEqual([updated]);
		});

		it("should detect a className change", () => {
			const original = makeEvent({ id: "1", className: "regular-event" });
			const updated = makeEvent({ id: "1", className: "regular-event prisma-virtual-event" });
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toEqual([updated]);
		});

		it("should detect an extendedProps change", () => {
			const original = makeEvent({
				id: "1",
				extendedProps: {
					filePath: "a.md",
					folder: "",
					originalTitle: "Event",
					frontmatterDisplayData: {},
					virtualKind: "none",
					skipped: false,
				},
			});
			const updated = makeEvent({
				id: "1",
				extendedProps: {
					filePath: "b.md",
					folder: "",
					originalTitle: "Event",
					frontmatterDisplayData: {},
					virtualKind: "none",
					skipped: false,
				},
			});
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toEqual([updated]);
		});

		it("should detect frontmatter data change", () => {
			const original = makeEvent({
				id: "1",
				extendedProps: {
					filePath: "test.md",
					folder: "",
					originalTitle: "Event",
					frontmatterDisplayData: { Status: "todo" },
					virtualKind: "none",
					skipped: false,
				},
			});
			const updated = makeEvent({
				id: "1",
				extendedProps: {
					filePath: "test.md",
					folder: "",
					originalTitle: "Event",
					frontmatterDisplayData: { Status: "done" },
					virtualKind: "none",
					skipped: false,
				},
			});
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toEqual([updated]);
		});

		it("should not flag unchanged events as changed", () => {
			const ev1 = makeEvent({ id: "1", title: "Unchanged" });
			const ev2 = makeEvent({ id: "2", title: "Original" });
			const ev2Updated = makeEvent({ id: "2", title: "Modified" });
			const previous = buildPreviousMap([ev1, ev2]);

			const diff = diffEvents(previous, [ev1, ev2Updated]);

			expect(diff.changed).toEqual([ev2Updated]);
			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
		});
	});

	describe("mixed operations", () => {
		it("should detect adds, removes, and changes simultaneously", () => {
			const unchanged = makeEvent({ id: "1", title: "Stable" });
			const willChange = makeEvent({ id: "2", title: "Before" });
			const willRemove = makeEvent({ id: "3", title: "Going away" });

			const previous = buildPreviousMap([unchanged, willChange, willRemove]);

			const changed = makeEvent({ id: "2", title: "After" });
			const added = makeEvent({ id: "4", title: "Brand new" });

			const diff = diffEvents(previous, [unchanged, changed, added]);

			expect(diff.added).toEqual([added]);
			expect(diff.removed).toEqual(["3"]);
			expect(diff.changed).toEqual([changed]);
		});

		it("should handle complete replacement of all events", () => {
			const old1 = makeEvent({ id: "a" });
			const old2 = makeEvent({ id: "b" });
			const new1 = makeEvent({ id: "c" });
			const new2 = makeEvent({ id: "d" });

			const previous = buildPreviousMap([old1, old2]);
			const diff = diffEvents(previous, [new1, new2]);

			expect(diff.added.map((e) => e.id)).toEqual(["c", "d"]);
			expect(diff.removed).toEqual(expect.arrayContaining(["a", "b"]));
			expect(diff.changed).toEqual([]);
		});

		it("should handle an event being both removed and a new one added with same properties but different id", () => {
			const old = makeEvent({ id: "old-1", title: "Meeting" });
			const replacement = makeEvent({ id: "new-1", title: "Meeting" });

			const previous = buildPreviousMap([old]);
			const diff = diffEvents(previous, [replacement]);

			expect(diff.removed).toEqual(["old-1"]);
			expect(diff.added).toEqual([replacement]);
			expect(diff.changed).toEqual([]);
		});
	});

	describe("large sets", () => {
		it("should handle diffing many events efficiently", () => {
			const count = 500;
			const events: PrismaEventInput[] = [];
			for (let i = 0; i < count; i++) {
				events.push(makeEvent({ id: `ev-${i}`, title: `Event ${i}` }));
			}

			const previous = buildPreviousMap(events);

			// Modify 3 events, remove 2, add 2
			const next = events.slice(2).map((ev, idx) => {
				if (idx < 3) {
					return makeEvent({ id: ev.id as string, title: `Modified ${idx}` });
				}
				return ev;
			});
			next.push(makeEvent({ id: "new-1" }));
			next.push(makeEvent({ id: "new-2" }));

			const diff = diffEvents(previous, next);

			expect(diff.removed).toEqual(expect.arrayContaining(["ev-0", "ev-1"]));
			expect(diff.removed).toHaveLength(2);
			expect(diff.added).toHaveLength(2);
			expect(diff.added.map((e) => e.id)).toEqual(["new-1", "new-2"]);
			expect(diff.changed).toHaveLength(3);
		});
	});

	describe("order independence", () => {
		it("should produce the same diff regardless of event order in next", () => {
			const ev1 = makeEvent({ id: "1", title: "A" });
			const ev2 = makeEvent({ id: "2", title: "B" });
			const ev3 = makeEvent({ id: "3", title: "C" });

			const previous = buildPreviousMap([ev1, ev2]);

			const diff1 = diffEvents(previous, [ev1, ev3]);
			const diff2 = diffEvents(previous, [ev3, ev1]);

			expect(new Set(diff1.removed)).toEqual(new Set(diff2.removed));
			expect(new Set(diff1.added.map((e) => e.id))).toEqual(new Set(diff2.added.map((e) => e.id)));
			expect(new Set(diff1.changed.map((e) => e.id))).toEqual(new Set(diff2.changed.map((e) => e.id)));
		});
	});

	describe("edge cases", () => {
		it("should handle duplicate ids in next array (last wins for seen set)", () => {
			const ev = makeEvent({ id: "1", title: "First" });
			const evDup = makeEvent({ id: "1", title: "Second" });
			const previous = buildPreviousMap([makeEvent({ id: "1", title: "First" })]);

			// Both have id "1", but the second one has a different title
			const diff = diffEvents(previous, [ev, evDup]);

			// The first "1" matches (unchanged), the second "1" is detected as changed
			// because it has a different fingerprint from the cached entry
			// Both are in the `next` array, so "1" is seen and not removed
			expect(diff.removed).toEqual([]);
		});

		it("should handle events with empty string ids", () => {
			const ev = makeEvent({ id: "" });
			const previous = buildPreviousMap([ev]);

			const diff = diffEvents(previous, [ev]);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});

		it("should handle events with special characters in ids", () => {
			const ev = makeEvent({ id: "event/2024-03-15/meeting@work" });
			const previous = buildPreviousMap([ev]);

			const diff = diffEvents(previous, [ev]);

			expect(diff.added).toEqual([]);
			expect(diff.removed).toEqual([]);
			expect(diff.changed).toEqual([]);
		});

		it("should correctly identify no-op when events have identical fingerprints", () => {
			const events = Array.from({ length: 10 }, (_, i) =>
				makeEvent({
					id: `ev-${i}`,
					title: `Event ${i}`,
					backgroundColor: `#${String(i).padStart(6, "0")}`,
				})
			);
			const previous = buildPreviousMap(events);

			const diff = diffEvents(previous, events);

			expect(diff.added).toHaveLength(0);
			expect(diff.removed).toHaveLength(0);
			expect(diff.changed).toHaveLength(0);
		});

		it("should detect change when only borderColor differs", () => {
			const original = makeEvent({ id: "1", borderColor: "#aaa" });
			const updated = makeEvent({ id: "1", borderColor: "#bbb" });
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toHaveLength(1);
		});

		it("should detect change when only virtualKind toggles", () => {
			const original = makeEvent({
				id: "1",
				extendedProps: {
					filePath: "test.md",
					folder: "",
					originalTitle: "Event",
					frontmatterDisplayData: {},
					virtualKind: "none",
					skipped: false,
				},
			});
			const updated = makeEvent({
				id: "1",
				extendedProps: {
					filePath: "test.md",
					folder: "",
					originalTitle: "Event",
					frontmatterDisplayData: {},
					virtualKind: "recurring",
					skipped: false,
				},
			});
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toHaveLength(1);
		});

		it("should detect change when allDay toggles from false to true", () => {
			const original = makeEvent({ id: "1", allDay: false });
			const updated = makeEvent({ id: "1", allDay: true });
			const previous = buildPreviousMap([original]);

			const diff = diffEvents(previous, [updated]);

			expect(diff.changed).toHaveLength(1);
		});
	});
});
