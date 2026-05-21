/**
 * `setExtendedPropSafe` mirrors the imperative base modal's filePath-rename
 * routing: FullCalendar's `EventApi` exposes `extendedProps` as a getter, so
 * direct assignment throws. Code paths that mutate event metadata after a
 * rename must route through `setExtendedProp(...)` when available, and fall
 * back to direct assignment only when the input is a plain object.
 */
import { describe, expect, it, vi } from "vitest";

import { setExtendedPropSafe } from "../../../src/react/modals/event/shared-modal-helpers";

describe("setExtendedPropSafe", () => {
	it("routes via setExtendedProp when the event exposes one (FullCalendar EventApi)", () => {
		let filePath = "original.md";
		const setExtendedProp = vi.fn((name: string, value: unknown) => {
			if (name === "filePath") filePath = String(value);
		});
		const eventData = {
			title: "Test",
			start: "2025-10-07T10:15:00",
			setExtendedProp,
			get extendedProps() {
				return { filePath };
			},
		};

		setExtendedPropSafe(eventData, "filePath", "renamed.md");

		expect(setExtendedProp).toHaveBeenCalledTimes(1);
		expect(setExtendedProp).toHaveBeenCalledWith("filePath", "renamed.md");
		expect(eventData.extendedProps.filePath).toBe("renamed.md");
	});

	it("falls back to direct assignment when extendedProps is a plain object", () => {
		const eventData = {
			title: "Test",
			start: "2025-10-07T10:15:00",
			extendedProps: { filePath: "original.md" } as Record<string, unknown>,
		};

		setExtendedPropSafe(eventData, "filePath", "renamed.md");

		expect(eventData.extendedProps["filePath"]).toBe("renamed.md");
	});

	it("is a no-op when neither setExtendedProp nor extendedProps is present", () => {
		const eventData = { title: "Test", start: "2025-10-07T10:15:00" };

		expect(() => setExtendedPropSafe(eventData, "filePath", "renamed.md")).not.toThrow();
	});
});
