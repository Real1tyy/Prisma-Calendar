import { describe, expect, it } from "vitest";

import { DRAG_EDGE_THRESHOLD_PX } from "../../../src/constants";
import { edgeScrollDirection } from "../../../src/utils/calendar/edge-scroll";

const rect = { left: 100, right: 500 };
const T = DRAG_EDGE_THRESHOLD_PX;

describe("edgeScrollDirection", () => {
	it.each([
		["inside the left edge band", rect.left + T - 1, "prev"],
		["inside the right edge band", rect.right - T + 1, "next"],
		["exactly on the left edge", rect.left, "prev"],
		["exactly on the right edge", rect.right, "next"],
	])("pages when the pointer is %s", (_label, pointerX, expected) => {
		expect(edgeScrollDirection(pointerX, rect, T)).toBe(expected);
	});

	it.each([
		["in the dead center", (rect.left + rect.right) / 2],
		["just past the left band", rect.left + T + 1],
		["just before the right band", rect.right - T - 1],
	])("does not page when the pointer is %s", (_label, pointerX) => {
		expect(edgeScrollDirection(pointerX, rect, T)).toBeNull();
	});
});
