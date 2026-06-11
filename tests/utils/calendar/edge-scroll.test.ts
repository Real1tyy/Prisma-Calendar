import { describe, expect, it } from "vitest";

import { DRAG_EDGE_THRESHOLD_PX } from "../../../src/constants";
import { edgeScrollDirection, verticalEdgeScrollDirection } from "../../../src/utils/calendar/edge-scroll";

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

const vRect = { top: 200, bottom: 600 };

describe("verticalEdgeScrollDirection", () => {
	it.each([
		["inside the top edge band", vRect.top + T - 1, "up"],
		["inside the bottom edge band", vRect.bottom - T + 1, "down"],
		["exactly on the top edge", vRect.top, "up"],
		["exactly on the bottom edge", vRect.bottom, "down"],
	])("scrolls when the pointer is %s", (_label, pointerY, expected) => {
		expect(verticalEdgeScrollDirection(pointerY, vRect, T)).toBe(expected);
	});

	it.each([
		["in the dead center", (vRect.top + vRect.bottom) / 2],
		["just past the top band", vRect.top + T + 1],
		["just before the bottom band", vRect.bottom - T - 1],
	])("does not scroll when the pointer is %s", (_label, pointerY) => {
		expect(verticalEdgeScrollDirection(pointerY, vRect, T)).toBeNull();
	});
});
