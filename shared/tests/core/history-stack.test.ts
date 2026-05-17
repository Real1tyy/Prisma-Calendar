import { describe, expect, it } from "vitest";

import { HistoryStack } from "../../src/core/history-stack";

describe("HistoryStack", () => {
	it("returns null from back/forward on empty stack", () => {
		const stack = new HistoryStack<string>();
		expect(stack.back()).toBeNull();
		expect(stack.forward()).toBeNull();
		expect(stack.current()).toBeNull();
	});

	it("tracks pushed entries and navigates back/forward", () => {
		const stack = new HistoryStack<string>();
		stack.push("a");
		stack.push("b");
		stack.push("c");

		expect(stack.current()).toBe("c");
		expect(stack.back()).toBe("b");
		expect(stack.back()).toBe("a");
		expect(stack.back()).toBeNull();
		expect(stack.forward()).toBe("b");
		expect(stack.forward()).toBe("c");
		expect(stack.forward()).toBeNull();
	});

	it("truncates forward history on push after back", () => {
		const stack = new HistoryStack<string>();
		stack.push("a");
		stack.push("b");
		stack.push("c");
		stack.back();
		stack.back();
		stack.push("x");

		expect(stack.current()).toBe("x");
		expect(stack.canGoForward()).toBe(false);
		expect(stack.back()).toBe("a");
	});

	it("deduplicates consecutive equal entries when equals is provided", () => {
		const stack = new HistoryStack<{ id: number }>({
			equals: (a, b) => a.id === b.id,
		});

		stack.push({ id: 1 });
		stack.push({ id: 1 });
		stack.push({ id: 2 });

		expect(stack.size).toBe(2);
	});

	it("respects maxSize by dropping oldest entries", () => {
		const stack = new HistoryStack<number>({ maxSize: 3 });
		stack.push(1);
		stack.push(2);
		stack.push(3);
		stack.push(4);

		expect(stack.size).toBe(3);
		expect(stack.back()).toBe(3);
		expect(stack.back()).toBe(2);
		expect(stack.back()).toBeNull();
	});

	it("navigate() suppresses pushes during the callback", () => {
		const stack = new HistoryStack<string>();
		stack.push("a");
		stack.push("b");
		stack.push("c");

		// Simulate back navigation where the callback triggers a re-entrant push
		const result = stack.navigate("back", () => {
			stack.push("b");
		});

		expect(result).toBe(true);
		expect(stack.canGoForward()).toBe(true);
		expect(stack.forward()).toBe("c");
	});

	it("navigate() preserves full forward history during forward navigation", () => {
		const stack = new HistoryStack<string>();
		stack.push("a");
		stack.push("b");
		stack.push("c");

		stack.back();
		stack.back();
		expect(stack.current()).toBe("a");

		stack.navigate("forward", () => {
			stack.push("b");
		});

		expect(stack.canGoForward()).toBe(true);
		expect(stack.forward()).toBe("c");
		expect(stack.canGoBack()).toBe(true);
	});

	it("navigate() returns false when there is nowhere to go", () => {
		const stack = new HistoryStack<string>();
		stack.push("a");

		expect(stack.navigate("back", () => {})).toBe(false);
		expect(stack.navigate("forward", () => {})).toBe(false);
	});

	it("clears all state", () => {
		const stack = new HistoryStack<string>();
		stack.push("a");
		stack.push("b");
		stack.clear();

		expect(stack.size).toBe(0);
		expect(stack.current()).toBeNull();
		expect(stack.canGoBack()).toBe(false);
		expect(stack.canGoForward()).toBe(false);
	});

	it("reports canGoBack/canGoForward correctly", () => {
		const stack = new HistoryStack<number>();
		expect(stack.canGoBack()).toBe(false);
		expect(stack.canGoForward()).toBe(false);

		stack.push(1);
		expect(stack.canGoBack()).toBe(false);
		expect(stack.canGoForward()).toBe(false);

		stack.push(2);
		expect(stack.canGoBack()).toBe(true);
		expect(stack.canGoForward()).toBe(false);

		stack.back();
		expect(stack.canGoBack()).toBe(false);
		expect(stack.canGoForward()).toBe(true);
	});

	describe("stack-style cursor (retreat / dropCurrent)", () => {
		it("retreat moves cursor below 0 and returns the entry being left behind", () => {
			const stack = new HistoryStack<string>();
			stack.push("a");

			expect(stack.hasCurrent()).toBe(true);
			expect(stack.retreat()).toBe("a");
			expect(stack.hasCurrent()).toBe(false);
			expect(stack.current()).toBeNull();
			expect(stack.canGoForward()).toBe(true);
			expect(stack.forward()).toBe("a");
		});

		it("retreat returns null when nothing is applied", () => {
			const stack = new HistoryStack<string>();
			expect(stack.retreat()).toBeNull();
		});

		it("dropCurrent splices out the cursor entry but keeps the forward branch", () => {
			const stack = new HistoryStack<string>();
			stack.push("a");
			stack.push("b");
			stack.push("c");
			stack.retreat();
			stack.retreat();
			stack.retreat();
			expect(stack.hasCurrent()).toBe(false);

			expect(stack.forward()).toBe("a");
			const dropped = stack.dropCurrent();
			expect(dropped).toBe("a");
			expect(stack.size).toBe(2);
			expect(stack.hasCurrent()).toBe(false);
			expect(stack.forward()).toBe("b");
			expect(stack.forward()).toBe("c");
		});

		it("dropCurrent returns null when nothing is applied", () => {
			const stack = new HistoryStack<string>();
			expect(stack.dropCurrent()).toBeNull();
		});

		it("appliedCount and forwardCount track cursor position", () => {
			const stack = new HistoryStack<string>();
			stack.push("a");
			stack.push("b");
			stack.push("c");

			expect(stack.appliedCount).toBe(3);
			expect(stack.forwardCount).toBe(0);

			stack.retreat();
			expect(stack.appliedCount).toBe(2);
			expect(stack.forwardCount).toBe(1);

			stack.retreat();
			stack.retreat();
			expect(stack.appliedCount).toBe(0);
			expect(stack.forwardCount).toBe(3);
		});

		it("peekForward returns the next entry without moving the cursor", () => {
			const stack = new HistoryStack<string>();
			stack.push("a");
			stack.push("b");
			stack.retreat();

			expect(stack.peekForward()).toBe("b");
			expect(stack.current()).toBe("a");
		});
	});
});
