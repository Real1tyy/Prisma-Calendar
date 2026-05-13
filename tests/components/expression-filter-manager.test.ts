import "@testing-library/jest-dom/vitest";

import { act, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountExpressionFilter, type ToolbarFilterHandle } from "../../src/components/toolbar-filter-mount";

function makeContainer(): HTMLElement {
	const container = document.createElement("div");
	const toolbarLeft = document.createElement("div");
	toolbarLeft.className = "fc-toolbar-chunk";
	container.appendChild(toolbarLeft);
	document.body.appendChild(container);
	return container;
}

const STUB_APP = {} as App;
const EXPR_INPUT_SELECTOR = ".prisma-fc-expression-input";

async function commit(input: HTMLInputElement, user: ReturnType<typeof userEvent.setup>, value: string): Promise<void> {
	await user.clear(input);
	if (value.length > 0) {
		// userEvent.type interprets `[` and `]` as Special chars; escape them with `[[`.
		const escaped = value.replace(/\[/g, "[[").replace(/{/g, "{{");
		await user.type(input, `${escaped}{Enter}`);
	} else {
		await user.type(input, "{Enter}");
	}
}

describe("mountExpressionFilter", () => {
	let container: HTMLElement;
	let handle: ToolbarFilterHandle | null;
	let onFilterChange: ReturnType<typeof vi.fn>;
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		container = makeContainer();
		onFilterChange = vi.fn();
		handle = null;
		user = userEvent.setup();
	});

	afterEach(() => {
		if (handle) {
			act(() => handle?.destroy());
		}
		document.body.replaceChildren();
	});

	function mount(): ToolbarFilterHandle {
		act(() => {
			handle = mountExpressionFilter({ app: STUB_APP, container, onFilterChange });
		});
		return handle!;
	}

	describe("initialization", () => {
		it("renders the input with the expression placeholder and testid", () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR);
			expect(input).toBeTruthy();
			expect(input?.placeholder).toBe("Status === 'Done'");
			expect(input?.className).toBe("prisma-fc-expression-input");
			expect(input?.getAttribute("data-testid")).toBe("prisma-filter-expression");
		});
	});

	describe("shouldInclude with expressions", () => {
		it("returns true when no expression is set", () => {
			mount();
			expect(handle!.shouldInclude({ meta: { Status: "Done", Priority: "High" } })).toBe(true);
		});

		it("evaluates equality", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, 'Status === "Done"');

			expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Status: "Pending" } })).toBe(false);
		});

		it("evaluates inequality", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, 'Status !== "Done"');

			expect(handle!.shouldInclude({ meta: { Status: "Pending" } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(false);
		});

		it("evaluates numeric comparisons", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, "Priority > 5");

			expect(handle!.shouldInclude({ meta: { Priority: 8 } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Priority: 3 } })).toBe(false);
			expect(handle!.shouldInclude({ meta: { Priority: 5 } })).toBe(false);
		});

		it("evaluates boolean checks", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, "Important === true");

			expect(handle!.shouldInclude({ meta: { Important: true } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Important: false } })).toBe(false);
		});

		it("evaluates logical AND", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, 'Status === "Done" && Priority > 5');

			expect(handle!.shouldInclude({ meta: { Status: "Done", Priority: 8 } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Status: "Done", Priority: 3 } })).toBe(false);
			expect(handle!.shouldInclude({ meta: { Status: "Pending", Priority: 8 } })).toBe(false);
		});

		it("evaluates logical OR", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, 'Status === "Done" || Status === "Archived"');

			expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Status: "Archived" } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Status: "Pending" } })).toBe(false);
		});

		it("supports array includes", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, 'Tags.includes("important")');

			expect(handle!.shouldInclude({ meta: { Tags: ["important", "urgent"] } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Tags: ["normal", "routine"] } })).toBe(false);
		});

		it("supports nested property access", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await commit(input, user, 'User.Name === "Alice"');

			expect(handle!.shouldInclude({ meta: { User: { Name: "Alice" } } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { User: { Name: "Bob" } } })).toBe(false);
		});

		it("treats undefined properties as falsy without warning", async () => {
			const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				mount();
				const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
				await commit(input, user, 'Status === "Done"');

				expect(handle!.shouldInclude({ meta: {} })).toBe(false);
				expect(handle!.shouldInclude({ meta: { OtherProp: "value" } })).toBe(false);
				expect(consoleWarn).not.toHaveBeenCalled();

				await commit(input, user, 'Status !== "Done"');
				expect(handle!.shouldInclude({ meta: {} })).toBe(true);
				expect(handle!.shouldInclude({ meta: { Status: "Pending" } })).toBe(true);
				expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(false);
			} finally {
				consoleWarn.mockRestore();
			}
		});

		it("handles events with no meta", async () => {
			const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				mount();
				const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
				await commit(input, user, 'Status === "Done"');

				expect(handle!.shouldInclude({})).toBe(false);
				expect(consoleWarn).not.toHaveBeenCalled();
			} finally {
				consoleWarn.mockRestore();
			}
		});
	});

	describe("error handling", () => {
		it("returns false for invalid expressions and warns", async () => {
			const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				mount();
				const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
				await commit(input, user, "Status === ");

				expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(false);
				expect(consoleWarn).toHaveBeenCalled();
			} finally {
				consoleWarn.mockRestore();
			}
		});

		it("recovers from a syntax error", async () => {
			const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				mount();
				const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
				await commit(input, user, "Status === 'unclosed string");

				expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(false);
				expect(consoleWarn).toHaveBeenCalled();
			} finally {
				consoleWarn.mockRestore();
			}
		});
	});

	describe("setFilterValue", () => {
		it("seeds the expression value and triggers a commit", () => {
			mount();
			act(() => handle!.setFilterValue('Status === "Done"'));

			expect(handle!.getCurrentFilterValue()).toBe('Status === "Done"');
			expect(onFilterChange).toHaveBeenCalled();
			expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(true);
			expect(handle!.shouldInclude({ meta: { Status: "Pending" } })).toBe(false);
		});

		it("invalidates the matcher when the expression changes via setFilterValue", () => {
			mount();
			act(() => handle!.setFilterValue('Status === "Done"'));
			expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(true);

			act(() => handle!.setFilterValue('Status === "Archived"'));
			expect(handle!.shouldInclude({ meta: { Status: "Done" } })).toBe(false);
			expect(handle!.shouldInclude({ meta: { Status: "Archived" } })).toBe(true);
		});
	});

	describe("focus", () => {
		it("focuses the expression input", () => {
			mount();
			handle!.focus();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR);
			expect(document.activeElement).toBe(input);
		});
	});

	describe("debouncing", () => {
		it("commits expression changes after the debounce window", async () => {
			mount();
			const input = container.querySelector<HTMLInputElement>(EXPR_INPUT_SELECTOR)!;
			await user.type(input, 'Status === "Done"');

			await waitFor(() => expect(onFilterChange).toHaveBeenCalled());
			expect(handle!.getCurrentFilterValue()).toBe('Status === "Done"');
		});
	});
});
