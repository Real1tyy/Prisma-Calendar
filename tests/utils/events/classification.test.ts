import { describe, expect, it } from "vitest";

import { isOrphanedFileEvent } from "../../../src/utils/events/classification";

const existsAmong =
	(paths: string[]) =>
	(filePath: string): boolean =>
		paths.includes(filePath);

describe("isOrphanedFileEvent", () => {
	it("flags a file-backed event whose backing file is gone", () => {
		const event = { extendedProps: { filePath: "Events/stale.md", virtualKind: "none" } };
		expect(isOrphanedFileEvent(event, existsAmong([]))).toBe(true);
	});

	it("does not flag a file-backed event whose file still exists", () => {
		const event = { extendedProps: { filePath: "Events/live.md", virtualKind: "none" } };
		expect(isOrphanedFileEvent(event, existsAmong(["Events/live.md"]))).toBe(false);
	});

	it.each(["recurring", "manual", "holiday"])("never flags a %s virtual event, even with no file", (virtualKind) => {
		const event = { extendedProps: { filePath: "Events/x.md", virtualKind } };
		expect(isOrphanedFileEvent(event, existsAmong([]))).toBe(false);
	});

	it("does not flag an event with no file path", () => {
		const event = { extendedProps: { virtualKind: "none" } };
		expect(isOrphanedFileEvent(event, existsAmong([]))).toBe(false);
	});
});
