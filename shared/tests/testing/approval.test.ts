// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { normalizeApprovalOutput, renderToApprovalString } from "../../src/testing/approval";

describe("renderToApprovalString", () => {
	it("should serialize a simple element", () => {
		const div = document.createElement("div");
		div.textContent = "Hello";

		const result = renderToApprovalString(div);
		expect(result).toContain("<div>");
		expect(result).toContain("Hello");
		expect(result).toContain("</div>");
	});

	it("should strip inline styles by default", () => {
		const div = document.createElement("div");
		div.style.color = "red";
		div.textContent = "styled";

		const result = renderToApprovalString(div);
		expect(result).not.toContain("style=");
	});

	it("should keep styles when keepStyles is true", () => {
		const div = document.createElement("div");
		div.style.color = "red";
		div.textContent = "styled";

		const result = renderToApprovalString(div, { keepStyles: true });
		expect(result).toContain("style=");
	});

	it("should strip UUID-like id attributes", () => {
		const div = document.createElement("div");
		div.id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
		div.textContent = "content";

		const result = renderToApprovalString(div);
		expect(result).not.toContain("a1b2c3d4");
	});

	it("should produce formatted, indented HTML", () => {
		const parent = document.createElement("div");
		parent.className = "container";
		const child = document.createElement("span");
		child.textContent = "text";
		parent.appendChild(child);

		const result = renderToApprovalString(parent);
		const lines = result.split("\n").filter((l) => l.trim());
		expect(lines.length).toBeGreaterThanOrEqual(3);
	});

	it("should handle nested elements", () => {
		const outer = document.createElement("div");
		const inner = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = "deep";
		inner.appendChild(span);
		outer.appendChild(inner);

		const result = renderToApprovalString(outer);
		expect(result).toContain("deep");
		expect(result).toContain("<span>");
	});
});

describe("normalizeApprovalOutput", () => {
	it("should replace UUIDs with placeholder", () => {
		const input = 'id="a1b2c3d4-e5f6-7890-abcd-ef1234567890"';
		const result = normalizeApprovalOutput(input);
		expect(result).toContain("[uuid]");
		expect(result).not.toContain("a1b2c3d4");
	});

	it("should strip ISO timestamps", () => {
		const input = "Created at 2026-03-15T10:30:00.000Z";
		const result = normalizeApprovalOutput(input);
		expect(result).not.toContain("2026-03-15T10:30:00");
	});

	it("should strip data-timestamp attributes", () => {
		const input = '<div data-timestamp="1710500000000">event</div>';
		const result = normalizeApprovalOutput(input);
		expect(result).not.toContain("1710500000000");
	});

	it("should leave non-dynamic content untouched", () => {
		const input = '<div class="event-card">Team Meeting</div>';
		const result = normalizeApprovalOutput(input);
		expect(result).toBe(input);
	});
});
